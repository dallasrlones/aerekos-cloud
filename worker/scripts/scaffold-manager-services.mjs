#!/usr/bin/env node
/**
 * Generates scaffold for all manager services from manager-services-manifest.json
 * Run from repo root: node worker/scripts/scaffold-manager-services.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_ROOT = path.join(__dirname, '..');
const MANIFEST = path.join(__dirname, 'manager-services-manifest.json');

const services = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

function writeFile(rel, content) {
  const full = path.join(WORKER_ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function errorHandlerJs() {
  return `function errorHandler(err, req, res, next) {
  console.error('[Error]', err);
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  res.status(status).json({
    error: { message, status, timestamp: new Date().toISOString(), path: req.path }
  });
}
module.exports = errorHandler;
`;
}

function portDetectionJs(serviceName) {
  return `const net = require('net');
async function detectAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => {
        console.log(\`[${serviceName}] Detected available port: \${port}\`);
        resolve(port);
      });
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(\`[${serviceName}] Port \${startPort} in use, trying \${startPort + 1}...\`);
        detectAvailablePort(startPort + 1).then(resolve).catch(reject);
      } else reject(err);
    });
  });
}
module.exports = detectAvailablePort;
`;
}

function serviceRegistrationJs(serviceName, capabilities, defaultPort) {
  const caps = JSON.stringify(capabilities);
  return `const axios = require('axios');
const detectAvailablePort = require('./portDetection');
async function registerWithConductor() {
  const conductorUrl = process.env.CONDUCTOR_URL;
  const name = process.env.SERVICE_NAME || '${serviceName}';
  const serviceVersion = process.env.SERVICE_VERSION || '1.0.0';
  const basePort = parseInt(process.env.PORT || '${defaultPort}', 10);
  const port = await detectAvailablePort(basePort);
  try {
    console.log(\`[\${name}] Registering with conductor at \${conductorUrl}...\`);
    const response = await axios.post(\`\${conductorUrl}/api/services/register\`, {
      name,
      version: serviceVersion,
      port,
      health_endpoint: '/health',
      ready_endpoint: '/ready',
      capabilities: ${caps},
      metadata: { description: '${serviceName} service' }
    }, { headers: { 'Content-Type': 'application/json' }, timeout: 10000 });
    console.log(\`[\${name}] Registered: \${response.data.service_id}\`);
    if (response.data.service_token) process.env.SERVICE_TOKEN = response.data.service_token;
    return response.data;
  } catch (error) {
    console.error(\`[\${name}] Registration failed:\`, error.message);
    if (error.response?.status === 404) {
      console.warn(\`[\${name}] POST /api/services/register not found — continuing without registry.\`);
      return null;
    }
    throw error;
  }
}
module.exports = { registerWithConductor };
`;
}

function routesIndexJs(serviceName, title) {
  return `const express = require('express');
const router = express.Router();
router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || '${serviceName}',
    title: '${title.replace(/'/g, "\\'")}',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'scaffold',
    message: 'Implement domain routes in api/routes/'
  });
});
module.exports = router;
`;
}

function indexJs(serviceName, defaultPort) {
  return `require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { registerWithConductor } = require('./api/utils/serviceRegistration');
const routes = require('./api/routes');
const errorHandler = require('./api/middleware/errorHandler');

const app = express();
const PORT = parseInt(process.env.PORT || '${defaultPort}', 10);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: process.env.SERVICE_NAME || '${serviceName}',
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', (req, res) => {
  res.status(200).json({ status: 'ready', service: process.env.SERVICE_NAME || '${serviceName}' });
});

app.use('/api/v1', routes);

app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(\`[${serviceName}] listening on \${PORT}\`);
    if (process.env.SKIP_SERVICE_REGISTRATION === 'true') return;
    if (!process.env.CONDUCTOR_URL) {
      console.warn('[${serviceName}] CONDUCTOR_URL not set; skipping conductor registration');
      return;
    }
    try {
      await registerWithConductor();
    } catch (e) {
      console.warn(\`[${serviceName}] Registration error:\`, e.message);
    }
  });
}

module.exports = app;
`;
}

function packageJson(serviceName, title, defaultPort) {
  return JSON.stringify(
    {
      name: serviceName,
      version: '1.0.0',
      description: title + ' — aerekos-cloud worker service',
      main: 'index.js',
      scripts: {
        start: 'node index.js',
        dev: 'nodemon index.js',
        test: 'jest',
        'test:watch': 'jest --watch',
        'test:coverage': 'jest --coverage',
        'test:integration': 'jest --testPathPattern=tests/integration',
        'test:unit': 'jest --testPathPattern=tests/unit',
        'test:e2e': 'echo "See tests/e2e/README.md — run against live stack"'
      },
      keywords: ['aerekos-cloud', serviceName],
      license: 'ISC',
      dependencies: {
        axios: '^1.6.0',
        cors: '^2.8.5',
        dotenv: '^16.3.1',
        express: '^4.18.2'
      },
      devDependencies: {
        jest: '^29.7.0',
        nodemon: '^3.0.1',
        supertest: '^6.3.3'
      }
    },
    null,
    2
  );
}

function jestConfig() {
  return `module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  collectCoverageFrom: ['api/**/*.js', 'index.js', '!**/node_modules/**'],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 15000
};
`;
}

function testsSetup() {
  return `process.env.NODE_ENV = 'test';
process.env.SKIP_SERVICE_REGISTRATION = 'true';
`;
}

function unitHealthTest(serviceName) {
  return `describe('${serviceName} health', () => {
  test('placeholder — expand with service-specific unit tests', () => {
    expect(true).toBe(true);
  });
});
`;
}

function integrationHealthTest(serviceName) {
  return `const request = require('supertest');
const app = require('../../index.js');

describe('${serviceName} integration', () => {
  test('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });
  test('GET /ready returns 200', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });
  test('GET /api/v1/info returns scaffold payload', async () => {
    const res = await request(app).get('/api/v1/info');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('service');
    expect(res.body).toHaveProperty('status', 'scaffold');
  });
});
`;
}

function e2eReadme(serviceName, title) {
  return `# E2E tests — ${title}

These are **manual / CI-job** scenarios until Playwright or a full docker-compose test harness is added.

## Prerequisites
- Conductor and at least one worker running
- This service built and registered (or \`CONDUCTOR_URL\` set for auto-register)

## Scenarios (checklist)
- [ ] **E2E-1:** Start \`${serviceName}\` container; \`GET /health\` from another container on the same Docker network returns 200.
- [ ] **E2E-2:** Conductor lists service in registry; proxy \`/api/services/${serviceName}/...\` works if routing is enabled.
- [ ] **E2E-3:** Graceful shutdown: SIGTERM finishes in-flight requests then exits.
- [ ] **E2E-4:** Invalid auth (when implemented) returns 401/403 consistently.
- [ ] **E2E-5:** Load test: baseline latency under expected RPS (define SLO in plan.md).

## Automating
Add \`tests/e2e/*.spec.js\` with Playwright or run supertest against \`docker compose\` URLs in CI (\`test:e2e:ci\` script).
`;
}

function envExample(serviceName, defaultPort) {
  return `# Copy to .env (gitignored)
PORT=${defaultPort}
SERVICE_NAME=${serviceName}
SERVICE_VERSION=1.0.0
NODE_ENV=development
# CONDUCTOR_URL=http://host.docker.internal:3000
# SKIP_SERVICE_REGISTRATION=true
`;
}

function gitignore() {
  return `node_modules/
.env
.env.local
coverage/
data/*.db
*.log
`;
}

function dockerfile(serviceName, defaultPort) {
  return `FROM node:18-alpine
WORKDIR /app
COPY ${serviceName}/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --only=production; else npm install --only=production; fi
COPY ${serviceName}/ ./
EXPOSE ${defaultPort}
CMD ["node", "index.js"]
`;
}

function dockerfileDev(serviceName, defaultPort) {
  return `FROM node:18-alpine
WORKDIR /app
COPY ${serviceName}/package*.json ./
RUN npm install
COPY ${serviceName}/ ./
EXPOSE ${defaultPort}
CMD ["npm", "run", "dev"]
`;
}

function dockerComposeYml(serviceName, defaultPort) {
  return `# Local dev — see worker/docker-compose.yml for full stack
services:
  ${serviceName}:
    build:
      context: ..
      dockerfile: ${serviceName}/Dockerfile.dev
    container_name: aerekos-${serviceName}
    ports:
      - "\${PORT:-${defaultPort}}:\${PORT:-${defaultPort}}"
    env_file:
      - .env
    environment:
      - NODE_ENV=development
    restart: unless-stopped
`;
}

function planMd(s) {
  const caps = s.capabilities.join(', ');
  const integrations = s.integrations ? s.integrations.join(', ') : 'Conductor, worker (Docker), optional key_manager / db_manager';
  const tunnelExtra =
    s.name === 'tunnel_manager'
      ? `
### Cloudflare (required reading)
- [ ] Document \`CLOUDFLARE_ACCOUNT_ID\`, \`CLOUDFLARE_API_TOKEN\` (DNS + Tunnel permissions)
- [ ] \`cloudflared\` sidecar or host install; token-based tunnel auth
- [ ] Never commit tunnel credentials; use secrets_manager or key_manager
`
      : '';

  return `# ${s.title} — implementation plan

**Service:** \`${s.name}\`  
**Default port:** ${s.port}  
**Capabilities (registry):** ${caps}  
**Description:** ${s.description}

## Dependencies
- **Platform:** ${integrations}
${tunnelExtra}

## Phase 1 — Scaffold (complete)
- [x] Express app, /health, /ready, /api/v1/info
- [x] Error middleware, conductor registration helper
- [x] Dockerfiles, docker-compose stub, Jest harness

## Phase 2 — Domain model & persistence
- [ ] Define entities and storage (SQLite via \`aerekos-record\` and/or conductor APIs)
- [ ] Repositories and migrations if using local DB
- [ ] Project scoping (\`project_id\`) on all resources

## Phase 3 — API surface
- [ ] OpenAPI / route map in README
- [ ] Validation (Joi or zod)
- [ ] Service-to-service auth middleware (conductor validate-token)

## Phase 4 — Worker & deployment integration
- [ ] Image build via worker \`ServiceManager\`; health checks for orchestrator
- [ ] Environment contract documented in \`.env_example\`

## Phase 5 — Observability
- [ ] Structured JSON logging
- [ ] \`GET /metrics\` (Prometheus) or push to \`metrics_manager\`
- [ ] Correlation / request IDs

## Phase 6 — Security
- [ ] Rate limits on public routes
- [ ] Audit log for sensitive operations
- [ ] Integration with \`iam_manager\` / \`secrets_manager\` as needed

---

## Testing (mandatory before “done”)

### Unit tests
- [ ] Core business logic (services layer) — happy paths
- [ ] Core business logic — error and edge cases
- [ ] Validators and pure utilities — 100% of public functions covered
- [ ] Mock external HTTP (axios) and Docker APIs where applicable

### Integration tests
- [ ] HTTP API with supertest (no manual server) — all routes return expected status/body
- [ ] Database layer against temp SQLite (if applicable)
- [ ] Conductor registration mocked; failure paths (404, 500)

### E2E tests
- [ ] Document scenarios in \`tests/e2e/README.md\` — all checkboxes executed at least once per release
- [ ] Optional: Playwright or CI job hitting docker-compose URLs
- [ ] Cross-service: conductor + worker + this service + one dependency (e.g. key_manager)

### Coverage & quality gates
- [ ] \`npm run test:coverage\` meets team threshold (suggest ≥70% lines for new code)
- [ ] No flaky timers — use Jest fake timers where needed
- [ ] Load smoke test script in \`scripts/\` (optional)

---

## References
- [new_service.md](../../new_service.md)
- [backend_guidelines.md](../../backend_guidelines.md)
- [testing_guidelines.md](../../testing_guidelines.md)
`;
}

function readmeMd(s) {
  const integ = s.integrations ? `**Integrations:** ${s.integrations.join(', ')}\n\n` : '';
  const cf =
    s.name === 'tunnel_manager'
      ? `## Cloudflare tunnels\nThis service is designed to drive **Cloudflare Tunnel** (\`cloudflared\`) for ingress. Store API tokens and tunnel secrets in **secrets_manager** or **key_manager**, never in git.\n\n`
      : '';

  return `# ${s.title}

${s.description}

${integ}${cf}## Status

**Scaffold** — business logic and persistence are not implemented yet. Follow [\`plan.md\`](./plan.md) and [\`new_service.md\`](../new_service.md).

## Quick start (local)

\`\`\`bash
cd worker/${s.name}
cp .env_example .env
npm install
npm run dev
# curl http://localhost:${s.port}/health
\`\`\`

## Environment

See [\`.env_example\`](./.env_example). Set \`CONDUCTOR_URL\` for auto-registration with the conductor.

## Docker

Build context is the parent \`worker/\` directory:

\`\`\`bash
docker compose -f docker-compose.yml up --build
\`\`\`

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | \`npm run test:unit\` | Extend \`tests/unit/\` |
| Integration | \`npm run test:integration\` | supertest against exported app |
| Coverage | \`npm run test:coverage\` | |
| E2E | \`tests/e2e/README.md\` | Manual + optional CI |

## API (scaffold)

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness |
| GET | /ready | Readiness |
| GET | /api/v1/info | Service metadata |

## Related services

- **Conductor** — routing, registry, auth
- **Worker** — container lifecycle
- See root [\`plan.md\`](../../plan.md) for full platform map
`;
}

for (const s of services) {
  const base = s.name;
  writeFile(`${base}/package.json`, packageJson(base, s.title, s.port) + '\n');
  writeFile(`${base}/index.js`, indexJs(base, s.port));
  writeFile(`${base}/api/middleware/errorHandler.js`, errorHandlerJs());
  writeFile(`${base}/api/routes/index.js`, routesIndexJs(base, s.title));
  writeFile(`${base}/api/utils/portDetection.js`, portDetectionJs(base));
  writeFile(`${base}/api/utils/serviceRegistration.js`, serviceRegistrationJs(base, s.capabilities, s.port));
  writeFile(`${base}/jest.config.js`, jestConfig());
  writeFile(`${base}/tests/setup.js`, testsSetup());
  writeFile(`${base}/tests/unit/health.test.js`, unitHealthTest(base));
  writeFile(`${base}/tests/integration/health.test.js`, integrationHealthTest(base));
  writeFile(`${base}/tests/e2e/README.md`, e2eReadme(base, s.title));
  writeFile(`${base}/.env_example`, envExample(base, s.port));
  writeFile(`${base}/.gitignore`, gitignore());
  writeFile(`${base}/Dockerfile`, dockerfile(base, s.port));
  writeFile(`${base}/Dockerfile.dev`, dockerfileDev(base, s.port));
  writeFile(`${base}/docker-compose.yml`, dockerComposeYml(base, s.port));
  writeFile(`${base}/plan.md`, planMd(s));
  writeFile(`${base}/README.md`, readmeMd(s));
}

console.log(`Scaffolded ${services.length} services under worker/`);
