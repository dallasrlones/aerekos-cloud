'use strict';

jest.mock('../../api/models', () => ({ Task: {} }));
jest.mock('../../api/services/DockerService', () => ({ DockerService: jest.fn() }));
jest.mock('../../api/services/FleetExec', () => ({ FleetExec: jest.fn() }));

const { TaskService } = require('../../api/services/TaskService');

describe('scaleTask replicas', () => {
  const prevSkip = process.env.SKIP_DOCKER;
  beforeAll(() => { process.env.SKIP_DOCKER = '0'; });
  afterAll(() => { process.env.SKIP_DOCKER = prevSkip; });

  test('refuses to spread a stateful task', async () => {
    const row = {
      id: 't1',
      project_id: 'p1',
      name: 'dbby',
      image: 'app:1',
      status: 'running',
      volumes: JSON.stringify(['data:/data']),
      replica_ids: '[]',
      pin_worker_id: '',
      worker_id: '',
      env: '{}',
      balancer_id: 'lb1',
    };
    const svc = new TaskService({
      Task: {
        findAll: async () => [row],
        update: async () => {},
      },
      docker: {},
      fleet: { isLocal: () => true, resolve: async () => ({ id: '', local: true }) },
    });
    await expect(svc.scaleTask('t1', 'p1', 2, { balancer_id: 'lb1' }))
      .rejects.toMatchObject({ code: 'STATEFUL_NO_SPREAD', status: 409 });
  });

  test('refuses to clone vLLM without allow_vllm_clone', async () => {
    const row = {
      id: 't2',
      project_id: 'p1',
      name: 'vllm',
      image: 'vllm/vllm-openai:latest',
      status: 'running',
      volumes: '[]',
      replica_ids: '[]',
      balancer_id: 'lb1',
    };
    const svc = new TaskService({
      Task: { findAll: async () => [row], update: async () => {} },
      docker: {},
      fleet: { isLocal: () => true, resolve: async () => ({ id: '', local: true }) },
    });
    await expect(svc.scaleTask('t2', 'p1', 2, { balancer_id: 'lb1' }))
      .rejects.toMatchObject({ code: 'NO_VLLM_CLONE', status: 409 });
  });

  test('N>1 requires a balancer', async () => {
    const row = {
      id: 't3',
      project_id: 'p1',
      name: 'web',
      image: 'app:1',
      status: 'running',
      volumes: '[]',
      replica_ids: '[]',
      balancer_id: '',
    };
    const svc = new TaskService({
      Task: { findAll: async () => [row], update: async () => {} },
      docker: {},
      fleet: { isLocal: () => true, resolve: async () => ({ id: '', local: true }) },
    });
    await expect(svc.scaleTask('t3', 'p1', 2, {}))
      .rejects.toMatchObject({ code: 'LB_REQUIRED', status: 409 });
  });
});
