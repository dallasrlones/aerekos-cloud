/**
 * One-shot generator: creates SQLite + CRUD MVP for P4 template services
 * (no live API keys; tests use temp DBs).
 * Run: node worker/scripts/generate-p4-sqlite-mvp.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workerRoot = path.join(__dirname, '..');

const dbClient = `const path = require('path');
const fs = require('fs');
const Record = require('aerekos-record');
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/SERVICE_KEY.db');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const db = Record.connect('sqlite', { database: dbPath, readonly: false, fileMustExist: false, timeout: 5000 });
module.exports = db;
`;

const indexApp = (port, key, title) => `require('dotenv').config();
const express = require('express');
const cors = require('cors');
require('./api/models');
const db = require('./api/utils/dbClient');
const { registerWithConductor } = require('./api/utils/serviceRegistration');
const { setupPrometheus } = require('../shared/simplePrometheusMetrics');
const routes = require('./api/routes');
const errorHandler = require('./api/middleware/errorHandler');
const app = express();
const PORT = parseInt(process.env.PORT || '${port}', 10);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
setupPrometheus(app, { serviceName: '${key}' });
app.get('/health', async (req, res) => {
  try {
    const health = await db.healthCheck();
    if (!health.healthy) {
      return res.status(503).json({ status: 'unhealthy', service: process.env.SERVICE_NAME || '${key}', error: health.error || 'Database check failed', timestamp: new Date().toISOString() });
    }
    res.status(200).json({ status: 'healthy', service: process.env.SERVICE_NAME || '${key}', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', service: process.env.SERVICE_NAME || '${key}', error: error.message, timestamp: new Date().toISOString() });
  }
});
app.get('/ready', async (req, res) => {
  try {
    const health = await db.healthCheck();
    if (!health.healthy) {
      return res.status(503).json({ status: 'not ready', service: process.env.SERVICE_NAME || '${key}', error: health.error || 'Database not available', timestamp: new Date().toISOString() });
    }
    res.status(200).json({ status: 'ready', service: process.env.SERVICE_NAME || '${key}' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message, timestamp: new Date().toISOString() });
  }
});
app.use('/api/v1', routes);
app.use(errorHandler);
if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(\`[${key}] listening on \${PORT}\`);
    if (process.env.SKIP_SERVICE_REGISTRATION === 'true') return;
    if (!process.env.CONDUCTOR_URL) { console.warn('[${key}] CONDUCTOR_URL not set; skipping registration'); return; }
    try { await registerWithConductor(); } catch (e) { console.warn('Registration error:', e.message); }
  });
}
module.exports = app;
`;

const pkgJson = (key) => `{
  "name": "${key}",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": { "start": "node index.js", "test": "jest" },
  "license": "ISC",
  "dependencies": {
    "aerekos-record": "^0.1.4",
    "axios": "^1.6.0",
    "better-sqlite3": "^9.6.0",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2"
  },
  "devDependencies": { "jest": "^29.7.0", "supertest": "^6.3.3" }
}
`;

const jestConf = `module.exports = { testEnvironment: 'node', maxWorkers: 1, testMatch: ['**/tests/**/*.test.js'], setupFilesAfterEnv: ['<rootDir>/tests/setup.js'], testTimeout: 15000 };
`;

const setup = `const path = require('path'); const os = require('os'); const fs = require('fs');
process.env.NODE_ENV = 'test'; process.env.SKIP_SERVICE_REGISTRATION = 'true';
if (!process.env.DATABASE_PATH) {
  const dir = path.join(os.tmpdir(), 'aerekos-'+require('../../package.json').name+'-tests');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  process.env.DATABASE_PATH = path.join(dir, 'test_'+Date.now()+'_'+process.pid+'.db');
}
`;

const healthTest = (key) => `const request = require('supertest');
const app = require('../../index.js');
describe('${key}', () => {
  test('GET /api/v1/info', async () => {
    const res = await request(app).get('/api/v1/info');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
  });
});
`;

const apiTest = (key, pathSeg, nameField) => `const request = require('supertest');
const app = require('../../index.js');
const Q = (id) => 'project_id='+encodeURIComponent(id);
describe('${key} crud', () => {
  const pid = 'p-${key}-'+Date.now();
  test('create list get delete', async () => {
    const c = await request(app).post('/api/v1/${pathSeg}').send({ project_id: pid, name: 'a', ${nameField} });
    expect(c.status).toBe(201);
    const id = c.body.item.id;
    const g = await request(app).get('/api/v1/${pathSeg}/'+id+'?'+Q(pid));
    expect(g.status).toBe(200);
    const d = await request(app).delete('/api/v1/${pathSeg}/'+id+'?'+Q(pid));
    expect(d.status).toBe(200);
  });
});
`;

// Service definitions: [folder, port, modelName, tableKey, extraFields as object, route segment, first body field for test, info message]
const SPECS = [
  ['balancer_manager', 3109, 'BalancerTarget', { address: 'string', weight: 'string', pool: 'string' }, 'targets', "address: '1.1.1.1'", 'Per-project load-balancer target hints; no cloud LB API yet.'],
  ['security_manager', 3108, 'SecurityFinding', { severity: 'string', source: 'string', details: 'string' }, 'findings', "name: 'f1', severity: 'low', source: 'unit', details: '{}'", 'Security findings and posture notes; integrate scanners later.'],
  ['host_manager', 3122, 'HostRecord', { hostname: 'string', address: 'string', role: 'string', metadata: 'string' }, 'hosts', "name: 'h1', hostname: 'n1', address: '10.0.0.1', role: 'worker', metadata: '{}'", 'Host / inventory records for workers and nodes.'],
  ['analytics_manager', 3117, 'AnalyticsEvent', { event: 'string', value: 'string', properties: 'string' }, 'events', "name: 'click', event: 'ui.click', value: '1', properties: '{}'", 'Structured analytics events (in-app, no third-party API).'],
  ['cdn_manager', 3118, 'CdnRule', { path_pattern: 'string', origin: 'string', cache_ttl_seconds: 'string' }, 'rules', "name: 'static', path_pattern: '/a/*', origin: 'https://o', cache_ttl_seconds: '60'", 'CDN-style routing rules; wire to a real edge later.'],
  ['mcp_manager', 3123, 'McpTool', { description: 'string', input_schema: 'string' }, 'tools', "name: 't1', description: 'd', input_schema: '{}'", 'MCP tool registry metadata.'],
  ['code_as_infra', 3120, 'IaModule', { kind: 'string', content: 'string' }, 'modules', "name: 'm1', kind: 'json', content: '{}'", 'Small IaC or config snippets.'],
  ['api_manager', 3124, 'ApiRoute', { method: 'string', public_path: 'string', backend_url: 'string' }, 'endpoints', "name: 'r1', method: 'GET', public_path: '/x', backend_url: 'http://b'", 'API gateway route definitions.'],
  ['app_manager', 3125, 'AppProject', { repo_url: 'string', build_command: 'string', metadata: 'string' }, 'apps', "name: 'app1', repo_url: 'https://g/a', build_command: 'npm test', metadata: '{}'", 'Application build project metadata.'],
  ['ai_manager', 3126, 'AiModelConfig', { provider: 'string', model: 'string', options: 'string' }, 'models', "name: 'g', provider: 'ollama', model: 'llama3', options: '{}'", 'LLM routing config; no live inference until keys/URLs set. Use SKIP_LLM=1.'],
  ['cicd_manager', 3119, 'CicdPipeline', { steps_json: 'string', state: 'string' }, 'pipelines', "name: 'ci', steps_json: '[]', state: 'idle'", 'Pipeline definitions; wire to CI with tokens later.'],
  ['crawler_manager', 3121, 'CrawlJob', { start_url: 'string', max_depth: 'string', result_summary: 'string', state: 'string' }, 'jobs', "name: 'j1', start_url: 'https://a.com', max_depth: '1', result_summary: '', state: 'pending'", 'Crawl jobs; run fetch with SKIP_CRAWL=1 in tests.'],
  ['auth_manager', 3116, 'OidcProvider', { provider_type: 'string', issuer: 'string', client_id: 'string', config_json: 'string' }, 'providers', "name: 'okta', provider_type: 'oidc', issuer: 'https://x', client_id: 'c', config_json: '{}'", 'OIDC/OAuth provider *metadata*; use secrets_manager for real client_secret.'],
  ['worker_manager', 3128, 'WorkerAnnotation', { worker_id: 'string', key: 'string', value: 'string' }, 'annotations', "name: 'n1', worker_id: 'w1', key: 'region', value: 'us'", 'Worker fleet labels and notes.'],
  ['system_manager', 3127, 'SystemTask', { spec_json: 'string', state: 'string' }, 'tasks', "name: 't1', spec_json: '{}', state: 'pending'", 'Maintenance task specs; no OS exec in MVP.'],
  ['email_manager', 3113, 'EmailMessage', { to_address: 'string', subject: 'string', body: 'string', status: 'string' }, 'messages', "name: 'e1', to_address: 'a@b', subject: 's', body: 'b', status: 'queued'", 'Email queue; send uses SKIP_SMTP=1.'],
  ['sms_manager', 3114, 'SmsMessage', { to_number: 'string', body: 'string', status: 'string' }, 'messages', "name: 's1', to_number: '+1', body: 'x', status: 'queued'", 'SMS messages; use SKIP_SMS=1.'],
  ['slack_manager', 3115, 'SlackMessage', { channel: 'string', text: 'string', status: 'string' }, 'messages', "name: 'z1', channel: '#a', text: 'hi', status: 'queued'", 'Slack post queue; use SKIP_SLACK=1.'],
  ['metrics_manager', 3105, 'MetricSeries', { metric_name: 'string', value: 'string', labels: 'string' }, 'series', "name: 's1', metric_name: 'cpu', value: '0.1', labels: '{}'", 'Time-series *samples*; optional scrape later.'],
];

function buildModelFields(extra) {
  return { project_id: 'string', name: 'string', ...extra };
}

function buildService(mName, ModelClass) {
  return `const { ${ModelClass} } = require('../models');
class ${mName}Service {
  constructor() { this.M = ${ModelClass}; }
  assertP(p) { if (!p||!String(p).trim()){const e=new Error('project_id required');e.status=400;throw e;} }
  async create(body) {
    this.assertP(body.project_id);
    const name = String(body.name||'').trim();
    if (!name) { const e = new Error('name required'); e.status=400; throw e; }
    const d = await this.M.findAll({ where: { project_id: body.project_id, name } });
    if (d.length) { const e = new Error('name taken'); e.status=409; throw e; }
    return this.M.create(body);
  }
  async list(projectId) { this.assertP(projectId); return this.M.findAll({ where: { project_id: projectId } }); }
  async get(id, projectId) { this.assertP(projectId); const r = await this.M.findAll({ where: { id, project_id: projectId } }); if (!r.length){const e=new Error('Not found');e.status=404;throw e;} return r[0]; }
  async update(id, projectId, body) {
    await this.get(id, projectId);
    const patch = { ...(body || {}) };
    delete patch.id; delete patch.project_id; delete patch.created_at; delete patch.updated_at;
    if (patch.name !== undefined) {
      const name = String(patch.name || '').trim();
      if (!name) { const e = new Error('name required'); e.status = 400; throw e; }
      const dup = await this.M.findAll({ where: { project_id: projectId, name } });
      if (dup.some((d) => String(d.id) !== String(id))) { const e = new Error('name taken'); e.status = 409; throw e; }
      patch.name = name;
    }
    if (Object.keys(patch).length) await this.M.update(id, patch);
    return this.get(id, projectId);
  }
  async del(id, projectId) { await this.get(id, projectId); await this.M.delete(id); return { deleted:true, id }; }
}
module.exports = { ${mName}Service };
`;
}

function buildRoutesFile(mName) {
  return `const express = require('express');
const { ${mName}Service } = require('../services/${mName}Service');
const r = express.Router();
const s = new ${mName}Service();
const q = (req) => req.query.project_id || req.body?.project_id || req.headers['x-project-id'];
r.post('/', async (req,res,next) => { try { const o = await s.create({ ...req.body, project_id: q(req) }); res.status(201).json({ item: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
r.get('/', async (req,res,next) => { try { const o = await s.list(q(req)); res.json({ items: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
r.get('/:id', async (req,res,next) => { try { const o = await s.get(req.params.id, q(req)); res.json({ item: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
const upd = async (req,res,next) => { try { const o = await s.update(req.params.id, q(req), req.body || {}); res.json({ item: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } };
r.patch('/:id', upd);
r.put('/:id', upd);
r.delete('/:id', async (req,res,next) => { try { res.json(await s.del(req.params.id, q(req))); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
module.exports = r;
`;
}

for (const [folder, port, mName, extra, pathSeg, testExtra, message] of SPECS) {
  const key = folder;
  const base = path.join(workerRoot, folder);
  if (!fs.existsSync(base)) continue;

  const fields = buildModelFields(extra);
  const modelBody = Object.entries(fields)
    .map(([k, v]) => `    ${k}: '${v}'`)
    .join(',\n');

  const modelFile = `const db = require('../utils/dbClient');
const M = db.model('${mName}', {\n${modelBody}\n  }, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });
module.exports = { ${mName}: M, db };
`;

  const ModelClass = mName;
  const svcBody = buildService(mName, mName);

  fs.mkdirSync(path.join(base, 'api/utils'), { recursive: true });
  fs.mkdirSync(path.join(base, 'api/models'), { recursive: true });
  fs.mkdirSync(path.join(base, 'api/services'), { recursive: true });
  fs.mkdirSync(path.join(base, 'api/routes'), { recursive: true });
  fs.mkdirSync(path.join(base, 'tests/integration'), { recursive: true });

  fs.writeFileSync(path.join(base, 'api/utils/dbClient.js'), dbClient.replace(/SERVICE_KEY/g, key));
  fs.writeFileSync(path.join(base, 'api/models/index.js'), modelFile);
  fs.writeFileSync(path.join(base, 'api/services/' + mName + 'Service.js'), svcBody);
  fs.writeFileSync(
    path.join(base, 'api/routes', pathSeg + '.js'),
    buildRoutesFile(mName)
  );
  const routesIndex = `const express = require('express');
const resR = require('./${pathSeg}');
const router = express.Router();
router.get('/info', (req, res) => { res.json({ service: process.env.SERVICE_NAME || '${key}', title: '${key}', version: process.env.SERVICE_VERSION || '1.0.0', status: 'active', message: ${JSON.stringify(message)} }); });
router.use('/${pathSeg}', resR);
module.exports = router;
`;
  fs.writeFileSync(path.join(base, 'api/routes/index.js'), routesIndex);
  fs.writeFileSync(path.join(base, 'index.js'), indexApp(port, key, key));
  fs.writeFileSync(path.join(base, 'package.json'), pkgJson(key));
  fs.writeFileSync(path.join(base, 'jest.config.js'), jestConf);
  const setupF = setup.replace("require('../../package.json').name", JSON.stringify(key));
  fs.writeFileSync(path.join(base, 'tests/setup.js'), setupF);
  fs.writeFileSync(path.join(base, 'tests/integration/health.test.js'), healthTest(key));
  fs.writeFileSync(path.join(base, 'tests/integration/crud.test.js'), apiTest(key, pathSeg, testExtra));
  // fix api test: embed extra fields
  const t = `const request = require('supertest');
const app = require('../../index.js');
const Q = (id) => 'project_id='+encodeURIComponent(id);
describe('${key} crud', () => {
  const pid = 'p-${key}-'+Date.now();
  test('create get update delete', async () => {
    const c = await request(app).post('/api/v1/${pathSeg}').send({ project_id: pid, name: 'n1', ${testExtra} });
    expect(c.status).toBe(201);
    const id = c.body.item.id;
    const g = await request(app).get('/api/v1/${pathSeg}/'+id+'?'+Q(pid));
    expect(g.status).toBe(200);
    const u = await request(app).patch('/api/v1/${pathSeg}/'+id+'?'+Q(pid)).send({ name: 'n2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('n2');
    const d = await request(app).delete('/api/v1/${pathSeg}/'+id+'?'+Q(pid));
    expect(d.status).toBe(200);
  });
});
`;
  fs.writeFileSync(path.join(base, 'tests/integration/crud.test.js'), t);
  console.log('wrote', key);
}

console.log('done');
