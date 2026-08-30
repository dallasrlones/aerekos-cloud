'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.SKIP_SERVICE_REGISTRATION = 'true';
if (!process.env.DATABASE_PATH) {
  const dir = path.join(os.tmpdir(), 'aerekos-cicd-deploy');
  fs.mkdirSync(dir, { recursive: true });
  process.env.DATABASE_PATH = path.join(dir, `t_${Date.now()}.db`);
}

jest.mock('../../../shared/conductorProxy', () => ({
  proxy: jest.fn(),
  conductorBase: () => 'http://conductor.test',
  authHeaders: () => ({ Authorization: 'Bearer t' }),
}));

const { proxy } = require('../../../shared/conductorProxy');
const { CicdPipelineService } = require('../../api/services/CicdPipelineService');

describe('CicdPipelineService.deploy', () => {
  beforeEach(() => {
    proxy.mockReset();
  });

  test('git source builds then creates a task named container_name', async () => {
    const svc = new CicdPipelineService();
    svc.get = jest.fn().mockResolvedValue({
      id: 'pipe-1',
      name: 'deploy-web',
      repo_id: 'repo-1',
      git_ref: 'main',
      dockerfile: 'Dockerfile',
    });
    svc.M.update = jest.fn().mockResolvedValue({});
    proxy
      .mockResolvedValueOnce({ status: 200, data: { image: 'aer-cmp-web:abc' } })
      .mockResolvedValueOnce({ status: 201, data: { task: { id: 'task-9', name: 'web' } } });

    const r = await svc.deploy('pipe-1', 'proj', { container_name: 'web' });
    expect(r.ok).toBe(true);
    expect(r.task.name).toBe('web');
    expect(proxy.mock.calls[1][0].path).toBe('/api/v1/tasks');
    expect(proxy.mock.calls[1][0].body.name).toBe('web');
    expect(proxy.mock.calls[1][0].body.image).toBe('aer-cmp-web:abc');
  });

  test('existing target_container_id replace-image, not a second create', async () => {
    const svc = new CicdPipelineService();
    svc.get = jest.fn().mockResolvedValue({
      id: 'pipe-2',
      name: 'deploy-web',
      repo_id: 'repo-1',
      target_container_id: 'task-1',
      target_image: 'old:1',
    });
    svc.M.update = jest.fn().mockResolvedValue({});
    proxy
      .mockResolvedValueOnce({ status: 200, data: { image: 'aer-cmp-web:def' } })
      .mockResolvedValueOnce({ status: 200, data: { task: { id: 'task-1', image: 'aer-cmp-web:def' } } });

    const r = await svc.deploy('pipe-2', 'proj', {});
    expect(r.ok).toBe(true);
    expect(proxy.mock.calls[1][0].path).toBe('/api/v1/tasks/task-1/replace-image');
    expect(r.task.id).toBe('task-1');
  });
});
