'use strict';

jest.mock('../../api/models', () => ({ Task: {} }));
jest.mock('../../api/services/DockerService', () => ({ DockerService: jest.fn() }));
jest.mock('../../api/services/FleetExec', () => ({ FleetExec: jest.fn() }));

const { TaskService } = require('../../api/services/TaskService');

const row = {
  id: 't1',
  project_id: 'p1',
  name: 'web',
  image: 'nginx:local',
  container_id: 'abc123',
  status: 'running',
  env: '{}',
  pin_worker_id: '',
  worker_id: '',
  worker_hostname: '',
};

describe('TaskService.stats', () => {
  const prevSkip = process.env.SKIP_DOCKER;
  beforeAll(() => { process.env.SKIP_DOCKER = '0'; });
  afterAll(() => { process.env.SKIP_DOCKER = prevSkip; });

  test('returns docker cpu and memory', async () => {
    const svc = new TaskService({
      Task: { findAll: async () => [row] },
      docker: { stats: async () => ({ cpu_percent: 12.3, memory_bytes: 67108864 }) },
      fleet: { stats: async () => null, isLocal: () => true },
    });
    const out = await svc.stats('t1', 'p1');
    expect(out).toEqual({
      task_id: 't1',
      running: true,
      cpu_percent: 12.3,
      memory_bytes: 67108864,
    });
  });

  test('missing container is not a 500', async () => {
    const gone = Object.assign(new Error('no such container'), { statusCode: 404 });
    const svc = new TaskService({
      Task: { findAll: async () => [row] },
      docker: { stats: async () => { throw gone; } },
      fleet: { stats: async () => null, isLocal: () => true },
    });
    const out = await svc.stats('t1', 'p1');
    expect(out.running).toBe(false);
    expect(out.error).toBe('container not found');
  });
});
