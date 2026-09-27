'use strict';

/**
 * Click-ops catalog — one primary CRUD resource per manager, plus stack JSON keys.
 *
 * Console ResourceCrud, StackService.provision, and setup first-resource all
 * read this file. Applying a project-stack JSON POSTs each recorded resource
 * back to the matching manager (CloudFormation analog).
 *
 * Never store secret values in stack JSON (see stripKeys / sanitizeResource).
 */

function singular(seg) {
  if (!seg) return 'resource';
  if (seg.endsWith('ies')) return `${seg.slice(0, -3)}y`;
  if (seg.endsWith('s')) return seg.slice(0, -1);
  return seg;
}

function fieldsFrom(obj) {
  return Object.entries(obj || {}).map(([key, v]) => ({
    key,
    label: key.replace(/_/g, ' '),
    placeholder: String(v),
  }));
}

function op(name, spec) {
  const segment = spec.segment;
  return {
    name,
    proxyBase: spec.proxyBase || '/api/v1',
    segment,
    stackKey: spec.stackKey,
    listKey: spec.listKey || 'items',
    singular: spec.singular || singular(segment),
    fields: spec.fields || [],
    defaults: spec.defaults || {},
    createPath: spec.createPath || null,
    listPath: spec.listPath || spec.createPath || null,
    applyPath: spec.applyPath || null,
    idField: spec.idField || 'id',
    stripKeys: spec.stripKeys || [],
    provision: spec.provision !== false,
    allowUpdate: spec.allowUpdate !== false,
    allowDelete: spec.allowDelete !== false,
  };
}

const NAME_FIELD = { key: 'name', label: 'Name', placeholder: 'my-resource' };

/** Uniform P4 SQLite CRUD managers (e2e/catalog.js P4_MANAGERS). */
const P4 = [
  { name: 'balancer_manager', segment: 'targets', stackKey: 'load_balancers', extra: { address: '10.0.0.9' } },
  { name: 'security_manager', segment: 'findings', stackKey: 'findings', extra: { severity: 'low', source: 'console', details: '{}' } },
  { name: 'host_manager', segment: 'hosts', stackKey: 'hosts', extra: { hostname: 'n1', address: '10.0.0.1', role: 'worker', metadata: '{}' } },
  { name: 'analytics_manager', segment: 'events', stackKey: 'analytics_events', extra: { event: 'ui.click', value: '1', properties: '{}' } },
  { name: 'cdn_manager', segment: 'rules', stackKey: 'cdn_rules', extra: { path_pattern: '/a/*', origin: 'https://origin.example', cache_ttl_seconds: '60' } },
  { name: 'mcp_manager', segment: 'tools', stackKey: 'mcp_tools', extra: { description: 'tool', input_schema: '{}' } },
  { name: 'code_as_infra', segment: 'modules', stackKey: 'modules', extra: { kind: 'json', content: '{}' } },
  { name: 'api_manager', segment: 'endpoints', stackKey: 'routes', extra: { method: 'GET', public_path: '/x', backend_url: 'http://backend' } },
  { name: 'app_manager', segment: 'apps', stackKey: 'apps', extra: { repo_url: 'https://git.example/a', build_command: 'npm test', metadata: '{}' } },
  { name: 'ai_manager', segment: 'models', stackKey: 'ai_models', extra: { provider: 'ollama', model: 'llama3', options: '{}' } },
  { name: 'cicd_manager', segment: 'pipelines', stackKey: 'pipelines', extra: { steps_json: '[]', state: 'idle' } },
  { name: 'crawler_manager', segment: 'jobs', stackKey: 'crawler_jobs', extra: { start_url: 'https://example.com', max_depth: '1', result_summary: '', state: 'pending' } },
  { name: 'auth_manager', segment: 'providers', stackKey: 'auth_providers', extra: { provider_type: 'oidc', issuer: 'https://issuer.example', client_id: 'client', config_json: '{}' } },
  { name: 'worker_manager', segment: 'annotations', stackKey: 'worker_annotations', extra: { worker_id: 'w1', key: 'region', value: 'us' } },
  { name: 'system_manager', segment: 'tasks', stackKey: 'system_tasks', extra: { spec_json: '{}', state: 'pending' } },
  { name: 'email_manager', segment: 'messages', stackKey: 'email_messages', extra: { to_address: 'dev@example.test', subject: 'hello', body: 'hi', status: 'queued' } },
  { name: 'sms_manager', segment: 'messages', stackKey: 'sms_messages', extra: { to_number: '+15555550100', body: 'hello', status: 'queued' } },
  { name: 'slack_manager', segment: 'messages', stackKey: 'slack_messages', extra: { channel: '#ops', text: 'hello', status: 'queued' } },
  { name: 'metrics_manager', segment: 'series', stackKey: 'metric_series', extra: { metric_name: 'cpu', value: '0.1', labels: '{}' } },
  { name: 'websocket_manager', segment: 'channels', stackKey: 'channels', extra: {} },
  { name: 'event_manager', segment: 'buses', stackKey: 'buses', extra: {} },
  { name: 'download_manager', segment: 'lists', stackKey: 'download_lists', extra: {} },
  { name: 'backup_manager', segment: 'vaults', stackKey: 'vaults', extra: {} },
  { name: 'workflow_manager', segment: 'machines', stackKey: 'machines', extra: {} },
  { name: 'config_manager', segment: 'namespaces', stackKey: 'namespaces', extra: {} },
  { name: 'cert_manager', segment: 'certs', stackKey: 'certs', extra: {}, stripKeys: ['pem', 'key_pem'] },
  { name: 'billing_manager', segment: 'meters', stackKey: 'meters', extra: {} },
  { name: 'function_manager', segment: 'functions', stackKey: 'functions', extra: {} },
  { name: 'iot_manager', segment: 'things', stackKey: 'things', extra: {} },
  { name: 'graphql_manager', segment: 'apis', stackKey: 'graphql_apis', extra: {} },
  { name: 'notebook_manager', segment: 'notebooks', stackKey: 'notebooks', extra: {} },
  { name: 'trace_manager', segment: 'traces', stackKey: 'traces', extra: {} },
  { name: 'search_manager', segment: 'indexes', stackKey: 'search_indexes', extra: {} },
  { name: 'query_manager', segment: 'queries', stackKey: 'queries', extra: {} },
  { name: 'waf_manager', segment: 'rules', stackKey: 'waf_rules', extra: {} },
  { name: 'vpn_manager', segment: 'peers', stackKey: 'vpn_peers', extra: {} },
  { name: 'transfer_manager', segment: 'endpoints', stackKey: 'transfer_endpoints', extra: {} },
  { name: 'audit_manager', segment: 'events', stackKey: 'audit_events', extra: {} },
  { name: 'status_manager', segment: 'incidents', stackKey: 'incidents', extra: {} },
  { name: 'cluster_manager', segment: 'clusters', stackKey: 'clusters', extra: {} },
  { name: 'vector_manager', segment: 'indexes', stackKey: 'vector_indexes', extra: {} },
  { name: 'push_manager', segment: 'subscriptions', stackKey: 'push_subscriptions', extra: {} },
];

const CUSTOM = [
  op('compute_manager', {
    segment: 'tasks',
    stackKey: 'compute',
    listKey: 'tasks',
    fields: [
      { key: 'image', label: 'Image', placeholder: 'nginx:alpine' },
    ],
    defaults: { image: 'nginx:alpine' },
  }),
  op('key_manager', {
    proxyBase: '/api',
    segment: 'keys',
    stackKey: 'keys',
    listKey: 'keys',
    createPath: '/api/keys',
    idField: 'name',
    fields: [
      { key: 'type', label: 'Type', placeholder: 'symmetric' },
      { key: 'algorithm', label: 'Algorithm', placeholder: 'AES-256-GCM' },
    ],
    defaults: { type: 'symmetric', algorithm: 'AES-256-GCM' },
    stripKeys: ['key_material'],
  }),
  op('storage_manager', {
    proxyBase: '/api',
    segment: 'buckets',
    stackKey: 'buckets',
    listKey: 'buckets',
    createPath: '/api/projects/{projectId}/buckets',
    idField: 'name',
    fields: [],
  }),
  op('db_manager', {
    proxyBase: '/api',
    segment: 'databases',
    stackKey: 'databases',
    listKey: 'databases',
    createPath: '/api/databases',
    idField: 'name',
    fields: [
      { key: 'type', label: 'Engine', placeholder: 'sqlite' },
    ],
    defaults: { type: 'sqlite' },
    stripKeys: ['password'],
  }),
  op('queue_manager', {
    segment: 'queues',
    stackKey: 'queues',
    listKey: 'queues',
    fields: [
      { key: 'engine', label: 'Engine', placeholder: 'standard' },
    ],
    defaults: { engine: 'standard' },
  }),
  op('schedule_manager', {
    segment: 'schedules',
    stackKey: 'schedules',
    listKey: 'schedules',
    fields: [
      { key: 'cron_expression', label: 'Cron', placeholder: '*/5 * * * *' },
      { key: 'action_type', label: 'Action', placeholder: 'queue' },
      { key: 'target_queue', label: 'Target queue', placeholder: 'jobs' },
    ],
    defaults: { cron_expression: '*/5 * * * *', action_type: 'queue' },
  }),
  op('network_manager', {
    segment: 'networks',
    stackKey: 'networks',
    listKey: 'networks',
    fields: [
      { key: 'driver', label: 'Driver', placeholder: 'bridge' },
    ],
    defaults: { driver: 'bridge' },
  }),
  op('logs_manager', {
    segment: 'logs',
    stackKey: 'log_streams',
    listKey: 'logs',
    fields: [
      { key: 'source', label: 'Source', placeholder: 'console' },
      { key: 'level', label: 'Level', placeholder: 'info' },
      { key: 'message', label: 'Message', placeholder: 'hello' },
    ],
    defaults: { source: 'console', level: 'info', message: 'hello' },
    allowUpdate: false,
    allowDelete: false,
  }),
  op('iam_manager', {
    segment: 'roles',
    stackKey: 'iam_roles',
    listKey: 'roles',
    fields: [
      { key: 'description', label: 'Description', placeholder: 'project role' },
    ],
  }),
  op('secrets_manager', {
    segment: 'secrets',
    stackKey: 'secrets',
    listKey: 'secrets',
    fields: [
      { key: 'value', label: 'Value', placeholder: 'stored once — never written to stack JSON', secret: true },
    ],
    stripKeys: ['value'],
  }),
  op('webhook_manager', {
    segment: 'webhooks',
    stackKey: 'webhooks',
    listKey: 'webhooks',
    fields: [
      { key: 'target_url', label: 'Target URL', placeholder: 'https://example.com/hook' },
    ],
    defaults: { target_url: 'https://example.com/hook' },
    stripKeys: ['secret'],
  }),
  op('git_manager', {
    segment: 'repos',
    stackKey: 'repos',
    listKey: 'repositories',
    fields: [],
  }),
  op('registry_manager', {
    segment: 'registries',
    stackKey: 'registries',
    listKey: 'registries',
    fields: [
      { key: 'url', label: 'URL', placeholder: 'http://registry.local:5050' },
    ],
  }),
  op('tunnel_manager', {
    segment: 'tunnels',
    stackKey: 'tunnels',
    listKey: 'tunnels',
    createPath: '/api/v1/tunnels',
    fields: [],
    stripKeys: ['token'],
  }),
  op('domain_manager', {
    segment: 'records',
    stackKey: 'hostnames',
    listKey: 'records',
    createPath: '/api/v1/dns/records',
    fields: [
      { key: 'type', label: 'Type', placeholder: 'CNAME' },
      { key: 'content', label: 'Content', placeholder: 'origin.example' },
    ],
    defaults: { type: 'CNAME' },
  }),
];

const P4_OPS = P4.map((row) => op(row.name, {
  segment: row.segment,
  stackKey: row.stackKey,
  fields: fieldsFrom(row.extra),
  defaults: { ...row.extra },
  stripKeys: row.stripKeys || [],
}));

/** api_manager also records Data API apply documents (not P4 endpoints). */
const DATA_API_OPS = op('api_manager', {
  segment: 'data-apis',
  stackKey: 'data_apis',
  listPath: '/api/v1/data-apis',
  applyPath: '/api/v1/data-apis/apply',
  fields: [
    { key: 'engine', label: 'Engine', placeholder: 'sqlite3' },
  ],
  defaults: { engine: 'sqlite3' },
});

const ALL = [...CUSTOM, ...P4_OPS, DATA_API_OPS];

const BY_NAME = new Map();
for (const row of ALL) {
  if (!BY_NAME.has(row.name)) BY_NAME.set(row.name, []);
  BY_NAME.get(row.name).push(row);
}

function getClickOps(serviceName) {
  const rows = BY_NAME.get(serviceName);
  return rows ? rows[0] : null;
}

function listClickOpsForService(serviceName) {
  return BY_NAME.get(serviceName) || [];
}

function listClickOps() {
  return ALL.slice();
}

function listClickOpsServiceNames() {
  return [...BY_NAME.keys()].sort();
}

function emptyStack(projectId) {
  const stack = {
    kind: 'project-stack',
    project_id: projectId || '',
    // services: [{ name, device, worker_id, config }] — IaC placement records.
    // device: explicit device name pins it; "auto" is resolved at apply time.
    services: [],
    hostnames: [],
    attachments: [],
    load_balancers: [],
    compute: [],
    routes: [],
    registries: [],
    wanted: [],
    networks: [],
    vpc: {},
    data_apis: [],
    functions: [],
    queues: [],
  };
  for (const row of ALL) {
    if (row.stackKey && !(row.stackKey in stack)) {
      stack[row.stackKey] = [];
    }
  }
  return stack;
}

const SECRET_KEYS = [
  'value', 'password', 'secret', 'token', 'key_material', 'pem', 'key_pem',
  'client_secret', 'access_key', 'private_key',
];

function sanitizeResource(ops, resource) {
  const out = { ...(resource || {}) };
  const extra = (ops && ops.stripKeys) || [];
  for (const k of [...SECRET_KEYS, ...extra]) {
    delete out[k];
  }
  return out;
}

function resolveStackKey(serviceName, key) {
  if (key) return key;
  const ops = getClickOps(serviceName);
  return ops ? ops.stackKey : null;
}

function mergeRecords(stack, entries) {
  let next = { ...stack };
  for (const entry of entries || []) {
    const key = resolveStackKey(entry.service, entry.key);
    const resource = entry.resource;
    if (!key || !resource || typeof resource !== 'object') continue;
    const ops = entry.service ? getClickOps(entry.service) : null;
    const clean = sanitizeResource(ops, resource);
    const list = Array.isArray(next[key]) ? [...next[key]] : [];
    const name = clean.name;
    if (!name) {
      list.push(clean);
    } else {
      const idx = list.findIndex((x) => x && x.name === name);
      if (idx >= 0) list[idx] = { ...list[idx], ...clean };
      else list.push(clean);
    }
    next = { ...next, [key]: list };
  }
  return next;
}

function removeRecords(stack, entries) {
  let next = { ...stack };
  for (const entry of entries || []) {
    const key = resolveStackKey(entry.service, entry.key);
    const name = entry.name;
    if (!key || !name) continue;
    const list = Array.isArray(next[key]) ? next[key].filter((x) => !x || x.name !== name) : [];
    next = { ...next, [key]: list };
  }
  return next;
}

function collectionPath(ops, projectId) {
  const raw = ops.applyPath || ops.createPath || ops.listPath || `${ops.proxyBase}/${ops.segment}`;
  return String(raw).replace(/\{projectId\}/g, projectId || '');
}

function itemPath(ops, projectId, id) {
  const base = collectionPath(ops, projectId).replace(/\/apply$/, '');
  const ident = encodeURIComponent(String(id));
  return `${base}/${ident}`;
}

module.exports = {
  NAME_FIELD,
  ALL,
  getClickOps,
  listClickOps,
  listClickOpsForService,
  listClickOpsServiceNames,
  emptyStack,
  sanitizeResource,
  resolveStackKey,
  mergeRecords,
  removeRecords,
  collectionPath,
  itemPath,
};
