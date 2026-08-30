#!/usr/bin/env node
/**
 * Generate first-party parity managers (Block A leftovers + Block B).
 * Run from repo root: node worker/scripts/generate-parity-managers.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workerRoot = path.join(__dirname, '..');

const MANAGERS = [
  { name: 'websocket_manager', port: 3131, aws: 'API Gateway WebSocket', category: 'Dev tools', segment: 'channels', title: 'WebSocket channels', extraFields: { auth_mode: 'string' }, defaultName: 'app', capabilities: ['realtime', 'websocket'] },
  { name: 'event_manager', port: 3132, aws: 'EventBridge', category: 'Integrations', segment: 'buses', title: 'Event buses', extraFields: { description: 'string' }, defaultName: 'default', capabilities: ['events', 'bus'] },
  { name: 'download_manager', port: 3133, aws: 'MediaConvert + ingest', category: 'Storage & Content', segment: 'lists', title: 'Download lists', extraFields: { bucket: 'string', prefix: 'string', window_id: 'string' }, defaultName: 'inbox', capabilities: ['download', 'torrent', 'yt-dlp'] },
  { name: 'backup_manager', port: 3134, aws: 'AWS Backup', category: 'Storage & Content', segment: 'vaults', title: 'Backup vaults', extraFields: { schedule: 'string', targets: 'string' }, defaultName: 'default', capabilities: ['backup'] },
  { name: 'workflow_manager', port: 3135, aws: 'Step Functions', category: 'Compute', segment: 'machines', title: 'State machines', extraFields: { definition: 'string', status: 'string' }, defaultName: 'hello', capabilities: ['workflow'] },
  { name: 'config_manager', port: 3136, aws: 'AppConfig', category: 'Identity', segment: 'namespaces', title: 'Config namespaces', extraFields: { flags: 'string' }, defaultName: 'app', capabilities: ['config', 'flags'] },
  { name: 'cert_manager', port: 3137, aws: 'ACM', category: 'Identity', segment: 'certs', title: 'Certificates', extraFields: { pem: 'string', hostnames: 'string', status: 'string' }, defaultName: 'default', capabilities: ['certs', 'tls'] },
  { name: 'billing_manager', port: 3138, aws: 'Cost Explorer', category: 'Management', segment: 'meters', title: 'Usage meters', extraFields: { unit: 'string', value: 'string' }, defaultName: 'compute_seconds', capabilities: ['billing', 'quotas'] },
  { name: 'function_manager', port: 3139, aws: 'Lambda', category: 'Compute', segment: 'functions', title: 'Functions', extraFields: { runtime: 'string', handler: 'string', timeout_ms: 'string', code_key: 'string' }, defaultName: 'hello', capabilities: ['lambda', 'functions'] },
  { name: 'iot_manager', port: 3140, aws: 'IoT Core', category: 'Edge', segment: 'things', title: 'IoT things', extraFields: { topic: 'string', status: 'string' }, defaultName: 'device-1', capabilities: ['iot', 'mqtt'] },
  { name: 'graphql_manager', port: 3141, aws: 'AppSync', category: 'Dev tools', segment: 'apis', title: 'GraphQL APIs', extraFields: { schema: 'string', data_app: 'string' }, defaultName: 'app', capabilities: ['graphql'] },
  { name: 'notebook_manager', port: 3142, aws: 'SageMaker notebook', category: 'AI', segment: 'notebooks', title: 'Notebooks', extraFields: { image: 'string', url: 'string', status: 'string' }, defaultName: 'lab', capabilities: ['notebook'] },
  { name: 'trace_manager', port: 3143, aws: 'X-Ray', category: 'Observability', segment: 'traces', title: 'Traces', extraFields: { trace_id: 'string', spans: 'string' }, defaultName: 'sample', capabilities: ['tracing'] },
  { name: 'search_manager', port: 3144, aws: 'OpenSearch', category: 'Database', segment: 'indexes', title: 'Search indexes', extraFields: { prefix: 'string', engine: 'string' }, defaultName: 'docs', capabilities: ['search'] },
  { name: 'query_manager', port: 3145, aws: 'Athena', category: 'Observability', segment: 'queries', title: 'SQL queries', extraFields: { sql: 'string', bucket: 'string', status: 'string' }, defaultName: 'sample', capabilities: ['athena', 'sql'] },
  { name: 'waf_manager', port: 3146, aws: 'WAF', category: 'Edge', segment: 'rules', title: 'WAF rules', extraFields: { action: 'string', cidr: 'string', path: 'string', rate: 'string' }, defaultName: 'default-rate', capabilities: ['waf'] },
  { name: 'vpn_manager', port: 3147, aws: 'Client VPN', category: 'Edge', segment: 'peers', title: 'VPN peers', extraFields: { config: 'string', status: 'string' }, defaultName: 'laptop', capabilities: ['vpn'] },
  { name: 'transfer_manager', port: 3148, aws: 'Transfer Family', category: 'Storage & Content', segment: 'endpoints', title: 'SFTP endpoints', extraFields: { bucket: 'string', protocol: 'string' }, defaultName: 'sftp', capabilities: ['sftp', 'transfer'] },
  { name: 'audit_manager', port: 3149, aws: 'CloudTrail', category: 'Observability', segment: 'events', title: 'Audit events', extraFields: { actor: 'string', action: 'string', detail: 'string' }, defaultName: 'bootstrap', capabilities: ['audit'] },
  { name: 'status_manager', port: 3150, aws: 'Statuspage', category: 'Observability', segment: 'incidents', title: 'Status incidents', extraFields: { severity: 'string', message: 'string', state: 'string' }, defaultName: 'all-clear', capabilities: ['status'] },
  { name: 'cluster_manager', port: 3151, aws: 'EKS', category: 'Compute', segment: 'clusters', title: 'Clusters', extraFields: { kubeconfig: 'string', status: 'string' }, defaultName: 'k3s', capabilities: ['k8s', 'k3s'] },
  { name: 'vector_manager', port: 3152, aws: 'OpenSearch kNN', category: 'AI', segment: 'indexes', title: 'Vector indexes', extraFields: { dim: 'string', backend: 'string' }, defaultName: 'rag', capabilities: ['vector', 'embeddings'] },
  { name: 'push_manager', port: 3153, aws: 'SNS mobile', category: 'Integrations', segment: 'subscriptions', title: 'Push subscriptions', extraFields: { endpoint: 'string', kind: 'string' }, defaultName: 'web', capabilities: ['push'] },
];

function write(rel, content) {
  const full = path.join(workerRoot, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

for (const m of MANAGERS) {
  const dir = m.name;
  const extraKeys = Object.keys(m.extraFields);
  const modelFields = extraKeys.map((k) => `    ${k}: '${m.extraFields[k]}',`).join('\n');
  const extraCreate = extraKeys.map((k) => `${k}: req.body?.${k} || ''`).join(',\n        ');

  write(`${dir}/package.json`, JSON.stringify({
    name: m.name,
    version: '1.0.0',
    main: 'index.js',
    scripts: { start: 'node index.js', test: 'jest' },
    license: 'ISC',
    dependencies: {
      'aerekos-record': '^0.1.4',
      axios: '^1.6.0',
      'better-sqlite3': '^9.6.0',
      cors: '^2.8.5',
      dotenv: '^16.3.1',
      express: '^4.18.2',
      ...(m.name === 'websocket_manager' ? { ws: '^8.18.0' } : {}),
    },
    devDependencies: { jest: '^29.7.0', supertest: '^6.3.3' },
  }, null, 2) + '\n');

  write(`${dir}/jest.config.js`, `module.exports = { testEnvironment: 'node', maxWorkers: 1, testMatch: ['**/tests/**/*.test.js'], setupFilesAfterEnv: ['<rootDir>/tests/setup.js'], testTimeout: 15000 };
`);

  write(`${dir}/tests/setup.js`, `const path = require('path'); const os = require('os'); const fs = require('fs');
process.env.NODE_ENV = 'test'; process.env.SKIP_SERVICE_REGISTRATION = 'true';
process.env.SKIP_DOWNLOAD = '1'; process.env.SKIP_TORRENT = '1'; process.env.SKIP_INVOKE = '1';
process.env.SKIP_POLLER = '1'; process.env.SKIP_OUTBOUND = '1'; process.env.SKIP_BROKER = '1';
process.env.SKIP_BACKUP = '1'; process.env.SKIP_ACME = '1'; process.env.SKIP_HEAL = '1';
if (!process.env.DATABASE_PATH) {
  const dir = path.join(os.tmpdir(), 'aerekos-${m.name}-tests');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  process.env.DATABASE_PATH = path.join(dir, 'test_'+Date.now()+'_'+process.pid+'.db');
}
`);

  write(`${dir}/api/utils/dbClient.js`, `const path = require('path');
const fs = require('fs');
const Record = require('aerekos-record');
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/${m.name}.db');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const db = Record.connect('sqlite', { database: dbPath, readonly: false, fileMustExist: false, timeout: 5000 });
module.exports = db;
`);

  write(`${dir}/api/models/index.js`, `const db = require('../utils/dbClient');
const Item = db.model('Item', {
    project_id: 'string',
    name: 'string',
${modelFields}
  }, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });
module.exports = { Item, db };
`);

  write(`${dir}/api/services/ItemService.js`, `const { Item } = require('../models');
const { CrudService } = require('../../../shared/crudBase');
class ItemService extends CrudService {
  constructor() { super(Item); }
  async ensureDefaults(projectId) {
    const items = await this.list(projectId);
    if (items.length) return { item: items[0], created: false };
    const item = await this.create({ project_id: projectId, name: '${m.defaultName}' });
    return { item, created: true };
  }
}
module.exports = { ItemService };
`);

  write(`${dir}/api/routes/index.js`, `const express = require('express');
const { crudRouter } = require('../../../shared/crudBase');
const { ItemService } = require('../services/ItemService');
const service = new ItemService();
const router = express.Router();
router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || '${m.name}',
    title: '${m.title}',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    aws: '${m.aws}',
    message: '${m.title}'
  });
});
router.use('/${m.segment}', crudRouter(service));
module.exports = { router, service };
`);

  write(`${dir}/index.js`, `require('dotenv').config();
require('./api/models');
const db = require('./api/utils/dbClient');
const { createManagerApp } = require('../shared/managerBootstrap');
const { makeRegister } = require('../shared/serviceRegistration');
const { router, service } = require('./api/routes');

const { app, listen } = createManagerApp({
  serviceName: '${m.name}',
  defaultPort: ${m.port},
  db,
  register: makeRegister({ serviceName: '${m.name}', defaultPort: ${m.port}, capabilities: ${JSON.stringify(m.capabilities)} }),
  ensureDefaults: (projectId) => service.ensureDefaults(projectId),
  extraSetup: (expressApp) => {
    expressApp.use('/api/v1', router);
  },
});

if (require.main === module) listen();
module.exports = app;
`);

  write(`${dir}/tests/integration/health.test.js`, `const request = require('supertest');
const app = require('../../index.js');
describe('${m.name}', () => {
  test('GET /api/v1/info', async () => {
    const res = await request(app).get('/api/v1/info');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
  });
  test('ensure-defaults', async () => {
    const pid = 'p-${m.name}-'+Date.now();
    const res = await request(app).post('/api/v1/ensure-defaults').send({ project_id: pid });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
`);

  write(`${dir}/tests/integration/crud.test.js`, `const request = require('supertest');
const app = require('../../index.js');
const Q = (id) => 'project_id='+encodeURIComponent(id);
describe('${m.name} crud', () => {
  const pid = 'p-${m.name}-crud-'+Date.now();
  test('create get update delete', async () => {
    const c = await request(app).post('/api/v1/${m.segment}').send({ project_id: pid, name: 'n1' });
    expect(c.status).toBe(201);
    const id = c.body.item.id;
    const g = await request(app).get('/api/v1/${m.segment}/'+id+'?'+Q(pid));
    expect(g.status).toBe(200);
    const u = await request(app).patch('/api/v1/${m.segment}/'+id+'?'+Q(pid)).send({ name: 'n2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('n2');
    const d = await request(app).delete('/api/v1/${m.segment}/'+id+'?'+Q(pid));
    expect(d.status).toBe(200);
  });
});
`);

  write(`${dir}/README.md`, `# ${m.name}

**AWS analog:** ${m.aws} · **Port:** ${m.port}

CRUD \`/api/v1/${m.segment}\` plus \`POST /api/v1/ensure-defaults\`.
`);
}

fs.writeFileSync(path.join(__dirname, 'parity-managers.json'), JSON.stringify(MANAGERS, null, 2));
console.log(`generated ${MANAGERS.length} managers`);
