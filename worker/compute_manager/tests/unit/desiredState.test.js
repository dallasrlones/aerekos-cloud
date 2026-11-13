'use strict';

jest.mock('../../api/models', () => ({ Task: {} }));
jest.mock('../../api/services/DockerService', () => ({ DockerService: jest.fn() }));
jest.mock('../../api/services/FleetExec', () => ({ FleetExec: jest.fn() }));

const { DesiredStateService } = require('../../api/services/DesiredStateService');
const { normalizeWorkload, planRollingReplace, diffWorkload } = require('../../api/services/workloadSpec');

describe('workloadSpec', () => {
  test('normalizeWorkload requires image', () => {
    expect(() => normalizeWorkload({ replicas: 1 })).toThrow(/image/);
  });

  test('planRollingReplace emits replace + scale steps', () => {
    const plan = planRollingReplace('nginx:1', { image: 'nginx:2', replicas: 3 });
    expect(plan.steps.map((s) => s.op)).toEqual(
      expect.arrayContaining(['replace_image', 'scale', 'reconcile_record']),
    );
  });

  test('diffWorkload detects image drift', () => {
    const d = diffWorkload(
      { image: 'a:2', replicas: 1, resources: {} },
      { image: 'a:1', desired_replicas: 1, resources: {} },
    );
    expect(d.inSync).toBe(false);
    expect(d.fields).toContain('image');
  });
});

describe('DesiredStateService', () => {
  const prevSkip = process.env.SKIP_DOCKER;
  beforeAll(() => { process.env.SKIP_DOCKER = '1'; });
  afterAll(() => { process.env.SKIP_DOCKER = prevSkip; });

  const row = {
    id: 't1',
    project_id: 'p1',
    name: 'web',
    image: 'app:v1',
    status: 'running',
    desired: 1,
    resource_limits: '{}',
    replica_ids: '[]',
    workload_spec: '',
  };

  function makeSvc(overrides = {}) {
    const store = { ...row, ...overrides };
    const Task = {
      findAll: async ({ where }) => {
        if (where.id && where.id !== store.id) return [];
        if (where.project_id && where.project_id !== store.project_id) return [];
        if (where.id) return [store];
        return [store];
      },
      update: async (id, patch) => {
        Object.assign(store, patch);
        return store;
      },
    };
    const taskService = {
      replaceImage: jest.fn(async () => ({ ...store, image: 'app:v2', status: 'running' })),
      scaleTask: jest.fn(async () => store),
    };
    return { svc: new DesiredStateService({ Task, taskService, journal: new Map() }), store, taskService };
  }

  test('setDesired persists workload_spec and desired replicas', async () => {
    const { svc, store } = makeSvc();
    const wl = await svc.setDesired('t1', 'p1', {
      image: 'app:v2',
      replicas: 2,
      probes: { liveness: { path: '/healthz' } },
      resources: { cpu: '0.5' },
    });
    expect(wl.replicas).toBe(2);
    expect(JSON.parse(store.workload_spec).image).toBe('app:v2');
    expect(store.desired).toBe(2);
  });

  test('reconcileTask records desired vs actual', async () => {
    const { svc, store } = makeSvc({ desired: 2, workload_spec: JSON.stringify({ image: 'app:v1', replicas: 2 }) });
    const rec = await svc.reconcileTask('t1', 'p1');
    expect(rec.desired.replicas).toBe(2);
    expect(rec.actual.replicas).toBe(1);
    expect(rec.drift.inSync).toBe(false);
    expect(rec.drift.fields).toContain('replicas');
    const journal = svc.getJournal('p1', 't1');
    expect(journal.length).toBe(1);
    expect(store.reconcile_snapshot).toBeTruthy();
  });

  test('rollingReplace applies Deployment and reconciles (SKIP_DOCKER)', async () => {
    const { svc, taskService } = makeSvc();
    const out = await svc.rollingReplace('t1', 'p1', { image: 'app:v2', replicas: 1 });
    // Node-agent dockerops skipped unless COMPUTE_E2E_DOCKER=1
    expect(taskService.replaceImage).not.toHaveBeenCalled();
    expect(out.deployment.kind).toBe('Deployment');
    expect(out.deployment.spec.template.spec.containers[0].image).toBe('app:v2');
    expect(out.aborted).toBe(false);
    expect(out.status.rolloutState).toBe('Complete');
  });

  test('runReconcileLoop stub returns records', async () => {
    const { svc } = makeSvc();
    const loop = await svc.runReconcileLoop('p1', { passes: 2 });
    expect(loop.passes).toBe(2);
    expect(loop.records.length).toBe(2);
  });
});
