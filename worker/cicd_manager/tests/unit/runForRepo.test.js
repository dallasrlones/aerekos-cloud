'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.SKIP_SERVICE_REGISTRATION = 'true';
if (!process.env.DATABASE_PATH) {
  const dir = path.join(os.tmpdir(), 'aerekos-cicd-rfr');
  fs.mkdirSync(dir, { recursive: true });
  process.env.DATABASE_PATH = path.join(dir, `t_${Date.now()}.db`);
}

jest.mock('../../api/models', () => ({ CicdPipeline: { findAll: jest.fn(), update: jest.fn(), create: jest.fn(), delete: jest.fn() } }));
jest.mock('../../../shared/conductorProxy', () => ({
  proxy: jest.fn(),
  conductorBase: () => 'http://conductor.test',
  authHeaders: () => ({ Authorization: 'Bearer t' }),
}));

const { CicdPipelineService } = require('../../api/services/CicdPipelineService');

describe('CicdPipelineService.runForRepo', () => {
  test('parseWorkflow reads test_command and bind', () => {
    const svc = new CicdPipelineService();
    const wf = svc.parseWorkflow('jobs:\n  - test\n  - deploy\ntest_command: npm --prefix server test\nbind:\n  hostname: app.example.com\n  port: 8080\n');
    expect(wf.jobs).toEqual(['test', 'deploy']);
    expect(wf.test_command).toBe('npm --prefix server test');
    expect(wf.bind).toEqual({ hostname: 'app.example.com', port: 8080 });
  });

  test('deployBranchOk only main unless git_ref set', () => {
    const svc = new CicdPipelineService();
    expect(svc.deployBranchOk({ git_ref: 'main' }, 'refs/heads/feat')).toBe(false);
    expect(svc.deployBranchOk({ git_ref: 'main' }, 'refs/heads/main')).toBe(true);
    expect(svc.deployBranchOk({ git_ref: 'prod' }, 'refs/heads/prod')).toBe(true);
  });

  test('runs every matching pipeline and skips deploy off main', async () => {
    const svc = new CicdPipelineService();
    svc.list = jest.fn().mockResolvedValue([
      { id: 'p1', name: 'api', repo_name: 'forged-lumen', git_ref: 'main', repo_id: 'r1' },
      { id: 'p2', name: 'web', repo_name: 'forged-lumen', git_ref: 'main', repo_id: 'r1' },
    ]);
    svc.loadWorkflow = jest.fn().mockResolvedValue({ jobs: ['deploy'], bind: null, test_command: '' });
    svc.run = jest.fn();
    svc.get = jest.fn().mockImplementation((id) => Promise.resolve({ id }));
    svc.M.update = jest.fn().mockResolvedValue({});
    const r = await svc.runForRepo('proj', { repo_name: 'forged-lumen', ref: 'refs/heads/feat', sha: 'abc' }, {});
    expect(r.ok).toBe(true);
    expect(r.skipped).toBe(true);
    expect(r.reason).toBe('not_deploy_branch');
    expect(svc.run).not.toHaveBeenCalled();
    expect(r.results).toHaveLength(2);
  });

  test('require_pr skips deploy unless the push is a merge', async () => {
    const svc = new CicdPipelineService();
    svc.list = jest.fn().mockResolvedValue([
      { id: 'p1', name: 'api', repo_name: 'app', git_ref: 'main', repo_id: 'r1', require_pr: 1 },
    ]);
    svc.loadWorkflow = jest.fn().mockResolvedValue({ jobs: ['deploy'], bind: null, test_command: '' });
    svc.run = jest.fn();
    svc.get = jest.fn().mockResolvedValue({ id: 'p1' });
    svc.M.update = jest.fn().mockResolvedValue({});
    const r = await svc.runForRepo('proj', { repo_name: 'app', ref: 'refs/heads/main', sha: 'abc' }, {});
    expect(r.results[0].reason).toBe('require_pr');
    expect(svc.run).not.toHaveBeenCalled();
  });
});
