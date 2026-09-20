'use strict';

jest.mock('../../api/models', () => ({ Task: {} }));
jest.mock('../../api/services/DockerService', () => ({ DockerService: jest.fn() }));
jest.mock('../../api/services/FleetExec', () => ({ FleetExec: jest.fn() }));

const { TaskService } = require('../../api/services/TaskService');

function gone() {
  const e = new Error('(HTTP code 404) no such container - No such container: dead');
  e.statusCode = 404;
  throw e;
}

describe('startTask missing container', () => {
  const prevSkip = process.env.SKIP_DOCKER;
  beforeAll(() => { process.env.SKIP_DOCKER = '0'; });
  afterAll(() => { process.env.SKIP_DOCKER = prevSkip; });

  const row = {
    id: 't1',
    project_id: 'p1',
    name: 'web',
    image: 'nginx:local',
    container_id: 'dead',
    status: 'stopped',
    env: '{}',
    pin_worker_id: '',
    worker_id: '',
    worker_hostname: '',
  };

  test('Start rebinds to a live container with the same Cloud name', async () => {
    const live = { Id: 'new', State: { Running: true, ExitCode: 0 } };
    const updates = [];
    const svc = new TaskService({
      Task: {
        findAll: async () => [{ ...row, ...(updates[updates.length - 1] || {}) }],
        update: async (_id, patch) => { updates.push(patch); },
      },
      docker: {
        startContainer: gone,
        inspectByName: async () => live,
        inspect: gone,
      },
      fleet: { start: async () => null, stop: async () => null, isLocal: () => true },
    });
    svc.replaceImage = jest.fn();
    const out = await svc.startTask('t1', 'p1');
    expect(svc.replaceImage).not.toHaveBeenCalled();
    expect(out.container_id).toBe('new');
    expect(out.status).toBe('running');
  });

  test('Start recreates only when no named container exists', async () => {
    const svc = new TaskService({
      Task: {
        findAll: async () => [row],
        update: async () => {},
      },
      docker: {
        startContainer: gone,
        inspectByName: async () => null,
        inspect: gone,
      },
      fleet: { start: async () => null, stop: async () => null, isLocal: () => true },
    });
    svc.replaceImage = jest.fn(async () => ({ id: 't1', status: 'running', container_id: 'created' }));
    const out = await svc.startTask('t1', 'p1');
    expect(svc.replaceImage).toHaveBeenCalledWith('t1', 'p1', 'nginx:local');
    expect(out.container_id).toBe('created');
  });
});

describe('getByIdRefreshed hostname', () => {
  const prevSkip = process.env.SKIP_DOCKER;
  beforeAll(() => { process.env.SKIP_DOCKER = '0'; });
  afterAll(() => { process.env.SKIP_DOCKER = prevSkip; });

  test('rewrites a stale local worker_hostname after inspect', async () => {
    const row = {
      id: 't1',
      project_id: 'p1',
      name: 'web',
      container_id: 'abc',
      status: 'running',
      exit_code: 0,
      pin_worker_id: '',
      worker_id: '',
      worker_hostname: 'old-cm',
      run_mode: 'service',
      env: '{}',
      port_bindings: '{}',
    };
    const updates = [];
    const svc = new TaskService({
      Task: {
        findAll: async () => [{ ...row, ...(updates[updates.length - 1] || {}) }],
        update: async (_id, patch) => { updates.push(patch); },
      },
      docker: {
        inspect: async () => ({ State: { Running: true, ExitCode: 0 } }),
        hostName: async () => 'new-cm',
      },
      fleet: {
        isLocal: () => true,
        inspect: async () => null,
      },
    });
    const out = await svc.getByIdRefreshed('t1', 'p1');
    expect(updates[0].worker_hostname).toBe('new-cm');
    expect(out.worker_hostname).toBe('new-cm');
  });
});
