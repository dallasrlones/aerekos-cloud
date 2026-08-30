'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.SKIP_SERVICE_REGISTRATION = 'true';
if (!process.env.DATABASE_PATH) {
  const dir = path.join(os.tmpdir(), 'aerekos-cicd-runforrepo');
  fs.mkdirSync(dir, { recursive: true });
  process.env.DATABASE_PATH = path.join(dir, `t_${Date.now()}.db`);
}

const { CicdPipelineService } = require('../../api/services/CicdPipelineService');

describe('CicdPipelineService.runForRepo', () => {
  test('sandbox aerekos-cloud is a no-op (not apply-stack, not fleet)', async () => {
    const svc = new CicdPipelineService();
    svc.list = jest.fn().mockResolvedValue([{ id: 'pipe-1', repo: 'aerekos-cloud' }]);
    svc.get = jest.fn().mockResolvedValue({ id: 'pipe-1', repo: 'aerekos-cloud' });
    svc.M.update = jest.fn().mockResolvedValue({});
    svc.run = jest.fn();
    const r = await svc.runForRepo('proj', { repo: 'aerekos-cloud' });
    expect(r.ok).toBe(true);
    expect(r.action).toBe('test');
    expect(r.results[0].step).toBe('fleet-noop');
    expect(svc.run).not.toHaveBeenCalled();
  });

  test('system aerekos-cloud main runs fleet', async () => {
    const svc = new CicdPipelineService();
    svc.list = jest.fn().mockResolvedValue([{ id: 'pipe-1', repo: 'aerekos-cloud', repo_id: 'r-cloud' }]);
    svc.loadWorkflow = jest.fn().mockResolvedValue({ jobs: ['test', 'fleet'], bind: null });
    svc.run = jest.fn().mockResolvedValue({ ok: true, action: 'fleet' });
    const r = await svc.runForRepo('9d8bde11-6933-4732-b746-602dcf72eaa5', {
      repo: 'aerekos-cloud',
      ref: 'refs/heads/main',
    });
    expect(svc.run).toHaveBeenCalledWith(
      'pipe-1',
      '9d8bde11-6933-4732-b746-602dcf72eaa5',
      expect.objectContaining({ action: 'fleet' }),
    );
    expect(r.action).toBe('fleet');
  });

  test('pipeline with target_container_id deploys on push', async () => {
    const svc = new CicdPipelineService();
    svc.list = jest.fn().mockResolvedValue([{ id: 'pipe-3', repo_name: 'my-app', target_container_id: 'task-1', repo_id: 'r1' }]);
    svc.run = jest.fn().mockResolvedValue({ ok: true, action: 'deploy' });
    const r = await svc.runForRepo('proj', { repo: 'my-app' });
    expect(svc.run).toHaveBeenCalledWith('pipe-3', 'proj', expect.objectContaining({ action: 'deploy' }));
    expect(r.action).toBe('deploy');
  });

  test('infra repo uses apply-stack', async () => {
    const svc = new CicdPipelineService();
    svc.list = jest.fn().mockResolvedValue([{ id: 'pipe-2', repo: 'infra' }]);
    svc.run = jest.fn().mockResolvedValue({ ok: true, action: 'apply-stack' });
    const r = await svc.runForRepo('proj', { repo: 'infra' });
    expect(svc.run).toHaveBeenCalledWith('pipe-2', 'proj', expect.objectContaining({ action: 'apply-stack' }));
    expect(r.action).toBe('apply-stack');
  });
});
