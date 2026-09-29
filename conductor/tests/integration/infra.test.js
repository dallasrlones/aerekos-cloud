/**
 * infra-as-code (task 5) — integration tests for the infra file flows:
 *
 *   GET  /api/projects/:id/infra/export   per-project file export (+ git commit)
 *   POST /api/projects/:id/infra/apply    device-aware up (auto/pinned placement,
 *                                         provisioning, file commit)
 *   POST /api/projects/:id/infra/down     soft (detach) / hard (detach + delete)
 *   GET  /api/system/infra/export         system tier file (devices, platform
 *                                         services, project index)
 *   POST /api/system/infra/import         create a new project from an infra file
 *
 * Uses the shared test helpers (tests/helpers/):
 *   loginAsAdmin + createApiClient  — the cucumber login step, real auth API
 *   mockServiceProxy                — no real workers: git/storage/etc are fake
 *   mockStackService + makeStackStore — deterministic stack revision store
 *   seedProjectFixture + cleanupTestData — data is ALWAYS seeded and torn down
 */
const request = require('supertest');
const app = require('../../index');
const {
  setupTestDatabase,
  cleanupTestData,
  seedProjectFixture,
} = require('../helpers/dbHelper');
const { loginAsAdmin } = require('../helpers/auth');
const { createApiClient } = require('../helpers/apiClient');
const { mockServiceProxy, restoreProxyMock } = require('../helpers/proxyMock');
const { makeStackStore, mockStackService, restoreStackService } = require('../helpers/stackStore');
const { PROD_PROJECT_ID } = require('../../../e2e/lib/prodGuard');
const { Project, ProjectService, Service, ServiceDeployment, Worker } = require('../../api/models');
const db = require('../../api/utils/db');
const SetupService = require('../../api/services/SetupService');
const IacHookupService = require('../../api/services/IacHookupService');
const InfraService = require('../../api/services/InfraService');
const { requireShared } = require('../../api/utils/loadWorkerShared');
const { emptyStack } = requireShared('clickOpsCatalog');

// git_manager proxy routes for every infra flow. Order matters: specific
// (prefix) routes before the exact-match list/create routes.
const GIT_ROUTES = [
  { service: 'git_manager', method: 'GET', path: '/api/v1/repos/',
    response: { status: 200, data: { content: '' } } }, // blob read: empty -> null
  { service: 'git_manager', method: 'GET', path: '/api/v1/repos',
    response: { status: 200, data: { repositories: [{ id: 'repo-infra', name: 'infra' }] } } },
  { service: 'git_manager', method: 'POST', path: '/api/v1/repos/',
    response: { status: 200, data: { committed: true } } }, // commit-file
  { service: 'git_manager', method: 'POST', path: '/api/v1/repos',
    response: { status: 201, data: { repository: { id: 'repo-infra', name: 'infra' } } } },
];

let session;
let api;
let proxy;
let stack;
let fx;

// Standard fleet: Prod-Mini (100GB free, online), Dev-Mini (500GB free,
// online), Orin (offline). storage_manager is enabled for the project and
// deployed on Prod-Mini; git_manager is enabled but not deployed yet.
const FLEET = {
  project: { name: 'infra-project' },
  workers: [
    { hostname: 'aerekos-server', status: 'online', resources: { cpu: 8, ram: 16, disk: { available_gb: 100 } } },
    { hostname: 'aerekos-M5-PLUS', status: 'online', resources: { cpu: 8, ram: 32, disk: { available_gb: 500 } } },
    { hostname: 'orin01', status: 'offline', resources: { cpu: 4, ram: 8, disk: { available_gb: 900 } } },
  ],
  services: [
    { name: 'storage_manager' },
    { name: 'git_manager' },
    { name: 'key_manager' },
  ],
  enable: ['storage_manager', 'git_manager'],
  deploy: { storage_manager: 'aerekos-server' },
};

beforeAll(async () => {
  await setupTestDatabase();
  session = await loginAsAdmin(app);
  api = createApiClient(app, session.token);
});

beforeEach(async () => {
  // seed — every test starts from the same known estate
  fx = await seedProjectFixture(FLEET);
  proxy = mockServiceProxy(GIT_ROUTES);
  stack = makeStackStore();
  mockStackService(stack);

  // SetupService: pretend enabling works, and record a REAL deployment row
  // so InfraService.projectServices() (which reads the DB) resolves the
  // device that gets baked back into the file.
  jest.spyOn(SetupService, 'enableWithDependencies').mockImplementation(async (projectId, name, opts = {}) => {
    const svc = (await Service.findAll({ where: { name } }))[0];
    if (svc && opts.workerId) {
      const ps = await ProjectService.findAll({ where: { project_id: projectId, service_id: svc.id } });
      if (!ps.length) {
        await ProjectService.create({ project_id: projectId, service_id: svc.id, enabled: 1 });
      }
      await ServiceDeployment.create({
        service_id: svc.id,
        worker_id: opts.workerId,
        project_id: projectId,
        status: 'deployed',
      });
    }
    return { results: [{ service: name, enabled: true }] };
  });
  jest.spyOn(IacHookupService, 'hookup').mockResolvedValue({ hooked_up: true, mode: 'git' });
  // InfraService's network boundaries (resource listing from the P4 managers,
  // system buckets) — no HTTP in tests.
  jest.spyOn(InfraService, 'listResources').mockResolvedValue({});
  jest.spyOn(InfraService, 'listAllSystemBuckets').mockResolvedValue([]);
});

afterEach(async () => {
  jest.restoreAllMocks();
  restoreStackService();
  restoreProxyMock();
  // teardown — whatever the test seeded is always cleaned up
  await cleanupTestData();
});

function stackWith(projectId, partial) {
  return { ...emptyStack(projectId), kind: 'project-stack', project_id: projectId, ...partial };
}

describe('per-project export (GET /:id/infra/export)', () => {
  test('exports live services with their real devices, bumps one revision', async () => {
    const res = await api.get(`/api/projects/${fx.project.id}/infra/export`, { query: { commit: '0' } });
    expect(res.status).toBe(200);
    expect(res.body.revision).toBe(1);
    expect(res.body.unchanged).toBe(false);
    expect(res.body.repo.committed).toBe(false); // commit=0

    const file = res.body.file;
    expect(file.kind).toBe('project-infra');
    expect(file.version).toBe(1);
    expect(file.project).toBe('infra-project');
    expect(file.project_id).toBe(fx.project.id);
    expect(file.revision).toBe(1);
    expect(file.generated_at).toBeTruthy();

    const byName = Object.fromEntries(file.services.map((s) => [s.name, s]));
    expect(byName.storage_manager.device).toBe('Prod-Mini'); // deployed on aerekos-server
    expect(byName.git_manager.device).toBe('auto');          // enabled, not deployed yet
    expect(file.wanted).toEqual(['storage_manager', 'git_manager']);
  });

  test('default export commits infra.json to the project infra repo', async () => {
    const res = await api.get(`/api/projects/${fx.project.id}/infra/export`);
    expect(res.status).toBe(200);
    expect(res.body.repo.committed).toBe(true);
    expect(res.body.repo.repo).toEqual({ id: 'repo-infra', name: 'infra' });

    const commits = proxy.callsTo('git_manager', 'POST', '/api/v1/repos/');
    expect(commits.length).toBe(1);
    expect(commits[0].path).toBe('/api/v1/repos/repo-infra/commit-file');
    expect(commits[0].body.path).toBe('infra.json');
    expect(commits[0].body.message).toContain('infra-project');
    expect(commits[0].body.content).toContain('"kind": "project-infra"');
  });

  test('exporting again with unchanged live state does not bump the revision', async () => {
    await api.get(`/api/projects/${fx.project.id}/infra/export`, { query: { commit: '0' } });
    const res = await api.get(`/api/projects/${fx.project.id}/infra/export`, { query: { commit: '0' } });
    expect(res.status).toBe(200);
    expect(res.body.revision).toBe(1);
    expect(res.body.unchanged).toBe(true);
  });

  test('unknown project -> 404', async () => {
    const res = await api.get('/api/projects/00000000-0000-4000-8000-000000000001/infra/export');
    expect(res.status).toBe(404);
  });

  test('unauthenticated -> 401', async () => {
    const res = await request(app).get(`/api/projects/${fx.project.id}/infra/export`);
    expect(res.status).toBe(401);
  });
});

describe('device-aware apply (POST /:id/infra/apply)', () => {
  // Apply tests start from a clean slate: remove the fixture's existing
  // deployment rows so only the placements made DURING the apply exist.
  async function clearDeployments() {
    for (const d of fx.deployments) await ServiceDeployment.delete(d.id);
  }

  test('device "auto" -> online worker with the most free disk', async () => {
    await clearDeployments();
    const file = {
      kind: 'project-infra',
      version: 1,
      services: [
        { name: 'ai_manager', device: 'auto' }, // non-platform: gets deployed
        { name: 'storage_manager', device: 'auto' }, // platform: attaches
      ],
      wanted: ['ai_manager', 'storage_manager'],
      buckets: [{ name: 'b1' }],
    };
    // This test exercises the REAL enable path (SetupService.enableWithDependencies
    // -> enableService -> ServiceManager.enableService via the faithful
    // proxyMock above) because it asserts on the deployment rows that get
    // created — the device that gets baked into the stack revision. The
    // beforeEach stub (which pretends enabling worked) is dropped for it.
    // Give it room: the real path also does ensure-defaults self-calls.
    SetupService.enableWithDependencies.mockRestore();
    const res = await api.post(`/api/projects/${fx.project.id}/infra/apply`, { file });
    expect(res.status).toBe(200);
    const byName = Object.fromEntries(res.body.services.map((s) => [s.name, s]));
    // "auto" resolves to the online worker with the most free disk (500GB > 100GB)
    expect(byName.ai_manager).toMatchObject({ status: 'ok', device: 'Dev-Mini' });
    expect(byName.storage_manager).toMatchObject({ status: 'ok', device: 'Dev-Mini' });

    // the resolved placements are baked into the new stack revision
    const cur = stack.current(fx.project.id);
    const baked = Object.fromEntries(cur.stack.services.map((s) => [s.name, s.device]));
    // the non-platform service now has a live deployment on Dev-Mini
    expect(baked.ai_manager).toBe('Dev-Mini');
    // the platform service attached but has no deployment of its own -> stays 'auto'
    expect(baked.storage_manager).toBe('auto');
    expect(cur.stack.wanted).toEqual(['ai_manager', 'storage_manager']);
  }, 30000);

  test('pinned device is honored (even when offline)', async () => {
    await clearDeployments();
    const file = {
      kind: 'project-infra',
      services: [
        { name: 'storage_manager', device: 'Orin' }, // offline but pinned
        { name: 'git_manager', device: 'Prod-Mini' },
      ],
      wanted: ['storage_manager', 'git_manager'],
    };
    const res = await api.post(`/api/projects/${fx.project.id}/infra/apply`, { file });
    expect(res.status).toBe(200);
    const byName = Object.fromEntries(res.body.services.map((s) => [s.name, s]));
    expect(byName.storage_manager).toMatchObject({ status: 'ok', device: 'Orin' });
    expect(byName.git_manager).toMatchObject({ status: 'ok', device: 'Prod-Mini' });
  });

  test('pinned device unknown (strict) -> 200 with a per-service error', async () => {
    await clearDeployments();
    const file = {
      kind: 'project-infra',
      services: [{ name: 'key_manager', device: 'no-such-device' }],
      wanted: ['key_manager'],
    };
    const res = await api.post(`/api/projects/${fx.project.id}/infra/apply`, { file });
    // apply is best-effort per service: the request itself succeeds and the
    // failed placement is reported on that service's row.
    expect(res.status).toBe(200);
    const byName = Object.fromEntries(res.body.services.map((s) => [s.name, s]));
    expect(byName.key_manager).toMatchObject({ status: 'error', requested: 'no-such-device' });
    expect(byName.key_manager.error).toContain('no-such-device');
  });

  test('pinned device unknown + any_device -> falls back to capacity pick', async () => {
    await clearDeployments();
    const file = {
      kind: 'project-infra',
      services: [{ name: 'key_manager', device: 'no-such-device' }],
      wanted: ['key_manager'],
    };
    const res = await api.post(`/api/projects/${fx.project.id}/infra/apply`, { file, any_device: true });
    expect(res.status).toBe(200);
    const byName = Object.fromEntries(res.body.services.map((s) => [s.name, s]));
    expect(byName.key_manager).toMatchObject({ status: 'ok', device: 'Dev-Mini' });
  });

  test('no workers in the fleet -> every service reports an error', async () => {
    const workers = await Worker.findAll();
    for (const w of workers) await Worker.delete(w.id);
    const file = {
      kind: 'project-infra',
      services: [{ name: 'key_manager', device: 'auto' }],
      wanted: ['key_manager'],
    };
    const res = await api.post(`/api/projects/${fx.project.id}/infra/apply`, { file });
    expect(res.status).toBe(200);
    const byName = Object.fromEntries(res.body.services.map((s) => [s.name, s]));
    expect(byName.key_manager).toMatchObject({ status: 'error' });
    expect(byName.key_manager.error).toContain('no workers in the fleet');
  });

  test('system-tier file on a project -> 400', async () => {
    const file = { kind: 'system-infra', version: 1, services: [], wanted: [] };
    const res = await api.post(`/api/projects/${fx.project.id}/infra/apply`, { file });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('system-tier');
  });

  test('unknown project -> 404', async () => {
    const res = await api.post('/api/projects/00000000-0000-4000-8000-000000000002/infra/apply', {});
    expect(res.status).toBe(404);
  });

  test('never apply to the production project -> 403', async () => {
    const prod = await Project.create({ name: 'prod-proj', enabled: 1, config: '{}' });
    db.db.prepare('UPDATE projects SET id = ? WHERE id = ?').run(PROD_PROJECT_ID, prod.id);
    const res = await api.post(`/api/projects/${PROD_PROJECT_ID}/infra/apply`, {});
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('production');
  });
});

describe('down (POST /:id/infra/down)', () => {
  test('soft: detaches the services, keeps the stack for re-apply, no deletes', async () => {
    stack.put(fx.project.id, stackWith(fx.project.id, {
      services: [
        { name: 'storage_manager', device: 'Prod-Mini', worker_id: fx.workers['aerekos-server'].id },
        { name: 'git_manager', device: 'auto' },
      ],
      wanted: ['storage_manager', 'git_manager'],
      buckets: [{ name: 'b1' }],
    }));

    const res = await api.post(`/api/projects/${fx.project.id}/infra/down`, {});
    expect(res.status).toBe(200);
    expect(res.body.hard).toBe(false);
    expect(res.body.disabled).toEqual(expect.arrayContaining([
      { name: 'storage_manager', status: 'detached' },
      { name: 'git_manager', status: 'detached' },
    ]));
    expect(res.body.deleted).toEqual({});
    expect(res.body.repo.committed).toBe(true);

    // stack preserved so a later apply re-enables everything
    const cur = stack.current(fx.project.id);
    expect(cur.revision).toBe(2);
    expect(cur.stack.wanted).toEqual(['storage_manager', 'git_manager']);

    // the detached file was committed with the downed status
    const commit = proxy.callsTo('git_manager', 'POST', '/api/v1/repos/')[0];
    expect(JSON.parse(commit.body.content).status).toBe('draft');
  });

  test('hard: detaches + deletes every resource the stack knows, empties the stack', async () => {
    stack.put(fx.project.id, stackWith(fx.project.id, {
      services: [{ name: 'storage_manager', device: 'Prod-Mini' }],
      wanted: ['storage_manager'],
      buckets: [{ name: 'b1' }],
      keys: [{ name: 'k1' }],
      databases: [{ name: 'd1' }],
      routes: [{ id: 'r1', name: 'r1' }],
    }));

    const res = await api.post(`/api/projects/${fx.project.id}/infra/down`, { hard: true });
    expect(res.status).toBe(200);
    expect(res.body.hard).toBe(true);
    expect(res.body.disabled).toEqual([{ name: 'storage_manager', status: 'detached' }]);
    expect(res.body.deleted.buckets[0]).toEqual({ name: 'b1', status: 200, ok: true });
    expect(res.body.deleted.keys[0]).toEqual({ name: 'k1', status: 200, ok: true });
    expect(res.body.deleted.databases[0]).toEqual({ name: 'd1', status: 200, ok: true });
    expect(res.body.deleted.routes[0]).toEqual({ name: 'r1', status: 200, ok: true });

    // DELETEs went to the right manager with the right item path
    expect(proxy.callsTo('storage_manager', 'DELETE')[0].path).toBe(`/api/projects/${fx.project.id}/buckets/b1`);
    expect(proxy.callsTo('key_manager', 'DELETE')[0].path).toBe('/api/keys/k1');
    expect(proxy.callsTo('db_manager', 'DELETE')[0].path).toBe('/api/databases/d1');
    expect(proxy.callsTo('api_manager', 'DELETE')[0].path).toBe('/api/v1/endpoints/r1');

    // stack reset
    const cur = stack.current(fx.project.id);
    expect(cur.revision).toBe(2);
    expect(cur.stack.wanted).toEqual([]);
    expect(cur.stack.services).toEqual([]);
  });

  test('unknown project -> 404', async () => {
    const res = await api.post('/api/projects/00000000-0000-4000-8000-000000000003/infra/down', {});
    expect(res.status).toBe(404);
  });
});

describe('system tier (GET /api/system/infra/export)', () => {
  test('devices, platform services and the project index; committed to the system project', async () => {
    await seedProjectFixture({ project: { name: 'system' } });
    // platform (non-project-scoped) deployment of git_manager on Prod-Mini
    await ServiceDeployment.create({
      service_id: fx.services.git_manager.id,
      worker_id: fx.workers['aerekos-server'].id,
      project_id: null,
      status: 'deployed',
    });
    // give the test project a stack so the index carries its revision
    stack.put(fx.project.id, stackWith(fx.project.id, {
      services: [{ name: 'storage_manager', device: 'Prod-Mini' }],
      wanted: ['storage_manager'],
    }));

    const res = await api.get('/api/system/infra/export');
    expect(res.status).toBe(200);
    const file = res.body.file;
    expect(file.kind).toBe('system-infra');
    expect(file.version).toBe(1);

    expect(file.devices.map((d) => d.name).sort()).toEqual(['Dev-Mini', 'Orin', 'Prod-Mini']);
    expect(file.system_resources.services).toEqual([{ name: 'git_manager', device: 'Prod-Mini' }]);

    const names = file.projects.map((p) => p.name).sort();
    expect(names).toEqual(['infra-project', 'system']);
    const idx = file.projects.find((p) => p.name === 'infra-project');
    expect(idx.infra).toBe('infra-project/infra.json');
    expect(idx.revision).toBe(1);
    expect(idx.services).toEqual([{ name: 'storage_manager', device: 'Prod-Mini' }]);
    expect(file.projects.find((p) => p.name === 'system').revision).toBe(0);

    expect(res.body.repo.committed).toBe(true);
    const commit = proxy.callsTo('git_manager', 'POST', '/api/v1/repos/')[0];
    expect(commit.body.path).toBe('system/infra.json');
  });

  test('no system project -> 404', async () => {
    await cleanupTestData(); // drop the fixture, no "system" project left
    const res = await api.get('/api/system/infra/export');
    expect(res.status).toBe(404);
  });
});

describe('import (POST /api/system/infra/import)', () => {
  test('creates a new project from the file and applies it', async () => {
    const file = {
      kind: 'project-infra',
      version: 1,
      services: [{ name: 'storage_manager', device: 'auto' }],
      wanted: ['storage_manager'],
      buckets: [{ name: 'ib1' }],
    };
    const res = await api.post('/api/system/infra/import', {
      name: 'imported-proj',
      description: 'born from an infra file',
      file,
    });
    expect(res.status).toBe(200);
    expect(res.body.project.name).toBe('imported-proj');
    expect(res.body.hookup.hooked_up).toBe(true);
    expect(res.body.hookup.mode).toBe('git');
    const svc = res.body.services.find((s) => s.name === 'storage_manager');
    expect(svc).toMatchObject({ status: 'ok', device: 'Dev-Mini' });
    expect(res.body.repo.committed).toBe(true);

    // the project really exists now
    const list = await api.get('/api/projects');
    expect(list.status).toBe(200);
    expect(list.body.projects.map((p) => p.name)).toContain('imported-proj');
  });

  test('duplicate name -> 409', async () => {
    const file = { kind: 'project-infra', services: [], wanted: [] };
    const res = await api.post('/api/system/infra/import', { name: 'infra-project', file });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('already exists');
  });

  test('missing file -> 400', async () => {
    const res = await api.post('/api/system/infra/import', { name: 'no-file-proj' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('file is required');
  });

  test('missing name -> 400', async () => {
    const res = await api.post('/api/system/infra/import', { file: { kind: 'project-infra' } });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('name is required');
  });
});
