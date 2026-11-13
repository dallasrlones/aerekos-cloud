'use strict';

jest.mock('../../api/models', () => ({ Task: {} }));
jest.mock('../../api/services/DockerService', () => ({ DockerService: jest.fn() }));
jest.mock('../../api/services/FleetExec', () => ({ FleetExec: jest.fn() }));

const { DeploymentController } = require('../../api/services/DeploymentController');
const {
  normalizeDeployment,
  planDeploymentRollout,
  shouldAbortRollout,
  CONDITIONS,
} = require('../../api/services/deploymentSpec');

describe('deploymentSpec', () => {
  test('normalizeDeployment builds K8s-shaped resource', () => {
    const d = normalizeDeployment({
      replicas: 3,
      strategy: { type: 'RollingUpdate', maxSurge: 1, maxUnavailable: 0 },
      template: { image: 'app:v1', name: 'web' },
    });
    expect(d.kind).toBe('Deployment');
    expect(d.apiVersion).toBe('compute.aerekos/v1');
    expect(d.spec.replicas).toBe(3);
    expect(d.spec.strategy.type).toBe('RollingUpdate');
    expect(d.spec.template.spec.containers[0].image).toBe('app:v1');
  });

  test('planDeploymentRollout aborts when failedReady', () => {
    const d = normalizeDeployment({ replicas: 2, template: { image: 'a:1', name: 'x' } });
    const plan = planDeploymentRollout(d, d, { failedReady: true });
    expect(plan.aborted).toBe(true);
    expect(plan.reason).toBe('ProgressDeadlineExceeded');
  });

  test('shouldAbortRollout after deadline', () => {
    const spec = { replicas: 2, progressDeadlineSeconds: 60, paused: false };
    const status = {
      readyReplicas: 0,
      rolloutStartedAt: new Date(Date.now() - 120_000).toISOString(),
    };
    expect(shouldAbortRollout(status, spec)).toBe(true);
  });
});

describe('DeploymentController', () => {
  const prevSkip = process.env.SKIP_DOCKER;
  beforeAll(() => { process.env.SKIP_DOCKER = '1'; });
  afterAll(() => { process.env.SKIP_DOCKER = prevSkip; });

  function make() {
    const store = {
      id: 't1',
      project_id: 'p1',
      name: 'web',
      image: 'app:v1',
      status: 'running',
      desired: 1,
      resource_limits: '{}',
      replica_ids: '[]',
      workload_spec: '',
      reconcile_snapshot: '',
    };
    const Task = {
      findAll: async ({ where }) => {
        if (where.id && where.id !== store.id) return [];
        if (where.project_id && where.project_id !== store.project_id) return [];
        return [store];
      },
      update: async (_id, patch) => {
        Object.assign(store, patch);
        return store;
      },
    };
    const taskService = {
      replaceImage: jest.fn(async () => store),
      scaleTask: jest.fn(async () => store),
    };
    let now = 1_000_000;
    const ctrl = new DeploymentController({
      Task,
      taskService,
      clock: () => now,
      revisions: new Map(),
    });
    return { ctrl, store, taskService, advance: (ms) => { now += ms; } };
  }

  test('apply persists Deployment and revision', async () => {
    const { ctrl, store } = make();
    const out = await ctrl.apply('t1', 'p1', {
      replicas: 2,
      template: { image: 'app:v2', name: 'web' },
    });
    expect(out.revision).toBe(1);
    expect(out.deployment.kind).toBe('Deployment');
    expect(JSON.parse(store.workload_spec).kind).toBe('Deployment');
    expect(store.desired).toBe(2);
  });

  test('reconcile completes under SKIP_DOCKER', async () => {
    const { ctrl } = make();
    await ctrl.apply('t1', 'p1', { replicas: 2, template: { image: 'app:v2', name: 'web' } });
    const r = await ctrl.reconcile('t1', 'p1');
    expect(r.aborted).toBe(false);
    expect(r.status.readyReplicas).toBe(2);
    expect(r.status.rolloutState).toBe('Complete');
  });

  test('forceFailReady aborts rollout', async () => {
    const { ctrl } = make();
    await ctrl.apply('t1', 'p1', { replicas: 2, template: { image: 'app:v2', name: 'web' } });
    const r = await ctrl.reconcile('t1', 'p1', { forceFailReady: true });
    expect(r.aborted).toBe(true);
    expect(r.status.rolloutState).toBe('Aborted');
    expect(r.status.conditions.some((c) => c.type === CONDITIONS.ReplicaFailure)).toBe(true);
  });

  test('pause and resume', async () => {
    const { ctrl } = make();
    await ctrl.apply('t1', 'p1', { replicas: 1, template: { image: 'app:v1', name: 'web' } });
    const p = await ctrl.pause('t1', 'p1');
    expect(p.deployment.spec.paused).toBe(true);
    expect(p.status.rolloutState).toBe('Paused');
    const r = await ctrl.resume('t1', 'p1');
    expect(r.deployment.spec.paused).toBe(false);
    expect(r.status.rolloutState).toBe('Progressing');
  });

  test('rollback to prior revision', async () => {
    const { ctrl } = make();
    await ctrl.apply('t1', 'p1', { replicas: 1, template: { image: 'app:v1', name: 'web' } });
    await ctrl.apply('t1', 'p1', { replicas: 1, template: { image: 'app:v2', name: 'web' } });
    const rb = await ctrl.rollback('t1', 'p1', 1);
    expect(rb.deployment.spec.template.spec.containers[0].image).toBe('app:v1');
  });

  test('progress deadline abort via clock', async () => {
    const { ctrl, advance } = make();
    await ctrl.apply('t1', 'p1', {
      replicas: 3,
      progressDeadlineSeconds: 60,
      template: { image: 'app:v9', name: 'web' },
    });
    // Force status to look stuck with 0 ready
    const row = await ctrl.getById('t1', 'p1');
    const snap = JSON.parse(row.reconcile_snapshot);
    snap.status.readyReplicas = 0;
    snap.status.rolloutState = 'Progressing';
    await ctrl.Task.update('t1', { reconcile_snapshot: JSON.stringify(snap) });
    advance(120_000);
    const r = await ctrl.reconcile('t1', 'p1');
    expect(r.aborted).toBe(true);
  });
});
