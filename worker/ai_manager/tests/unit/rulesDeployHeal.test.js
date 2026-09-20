'use strict';

const { denyForPersona, cmdDenied, pathLooksSecret } = require('../../api/services/workerRules/denylist');
const { dangerClassify, executeTool } = require('../../api/services/workspaceTools');
const Deploy = require('../../api/services/DeployService');
const { shouldHeal } = require('../../api/services/ContainerHeal');
const { LIVE_EVENTS } = require('../../../../conductor/api/services/LiveRoom');

describe('rules, deploy deny, heal', () => {
  test('.env read 403', () => {
    expect(pathLooksSecret('.env')).toBe(true);
    expect(denyForPersona('dev', 'file_read', { path: '.env' }).level).toBe('deny');
    expect(dangerClassify('file_read', { path: 'worker/.env' }, '/tmp', 'dev').level).toBe('deny');
    const ran = executeTool('file_read', { path: '.env' }, { root: '/tmp', persona: 'dev' });
    expect(ran.denied).toBe(true);
  });

  test('rm -rf data 403', () => {
    expect(cmdDenied('rm -rf data').deny).toBe(true);
    expect(denyForPersona('dev', 'shell', { cmd: 'rm -rf data' }).level).toBe('deny');
    expect(dangerClassify('shell', { cmd: 'rm -rf ./data' }, '/tmp', 'dev').level).toBe('deny');
  });

  test('research cannot write', () => {
    expect(denyForPersona('research', 'file_write', { path: 'x.txt' }).level).toBe('deny');
    const ran = executeTool('file_write', { path: 'x.txt', content: 'no' }, { root: '/tmp', persona: 'research' });
    expect(ran.denied).toBe(true);
  });

  test('deploy deny table', () => {
    expect(Deploy.denyReason('vllm')).toMatch(/unknown|denied/);
    expect(Deploy.denyReason('frontend', 'deploy.sh full')).toMatch(/denied/);
    expect(Deploy.denyReason('conductor', '--remove-orphans')).toMatch(/denied/);
    expect(Deploy.denyReason('ai_manager', 'auth_manager')).toMatch(/denied/);
    expect(Deploy.denyReason('frontend', 'ea370977-3aff-4c76-95a6-a0c50fd2bce7')).toMatch(/denied/);
    expect(Deploy.denyReason('frontend')).toBeNull();
    expect(Deploy.RECIPES.ai_manager.speak).toMatch(/brain/i);
  });

  test('heal starts cheap crash; skips 137 and explicit GPU stop', () => {
    const cheap = shouldHeal('aerekos-icarus-workspace', { State: { Running: false, ExitCode: 1 } });
    expect(cheap.heal).toBe(true);
    const oom = shouldHeal('aerekos-vllm', { State: { Running: false, ExitCode: 137, OOMKilled: true } });
    expect(oom.heal).toBe(false);
    expect(oom.reason).toMatch(/OOM/);
    const stopped = shouldHeal('vllm', {
      State: { Running: false, ExitCode: 0, FinishedAt: '2026-01-01T00:00:00Z', Error: '' },
    });
    expect(stopped.heal).toBe(false);
    const auth = shouldHeal('auth_manager', { State: { Running: false, ExitCode: 1 } });
    expect(auth.heal).toBe(false);
  });

  test('LiveRoom allowlists ask events', () => {
    expect(LIVE_EVENTS.has('ai:agent.ask')).toBe(true);
    expect(LIVE_EVENTS.has('ai:agent.ask.answered')).toBe(true);
    expect(LIVE_EVENTS.has('ai:agent.pulse')).toBe(true);
    expect(LIVE_EVENTS.has('ai:agent.done')).toBe(true);
  });
});
