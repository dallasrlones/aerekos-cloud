'use strict';

const { FleetExec } = require('../../api/services/FleetExec');

describe('FleetExec.isLocal', () => {
  const fleet = new FleetExec();

  test('empty pin is always local even with a stale hostname', () => {
    expect(fleet.isLocal({ id: '', hostname: 'a0f6e402f74a' })).toBe(true);
    expect(fleet.isLocal({ id: '', hostname: '' })).toBe(true);
    expect(fleet.isLocal(null)).toBe(true);
  });

  test('pinned other worker is remote', () => {
    expect(fleet.isLocal({ id: 'other-worker', hostname: 'orin' })).toBe(false);
  });
});

describe('FleetExec.resolve skipCapacity', () => {
  test('pinned adopt skips can-fit', async () => {
    const fleet = new FleetExec();
    fleet.hosts = async () => ([{ id: 'orin', hostname: 'ubuntu', status: 'online' }]);
    fleet.localId = () => 'prod';
    fleet.localHostname = () => 'prod-mini';
    const host = await fleet.resolve({ pin: 'orin', skipCapacity: true, requestGb: 40 });
    expect(host.id).toBe('orin');
    expect(host.local).toBe(false);
  });
});

describe('FleetExec.resolve empty pin', () => {
  test('empty pin stays local unless place is any', async () => {
    const fleet = new FleetExec();
    fleet.hosts = async () => ([
      { id: 'local-w', hostname: 'prod-mini', status: 'online' },
      { id: 'dev-w', hostname: 'dev-mini', status: 'online' },
    ]);
    fleet.localId = () => 'local-w';
    fleet.localHostname = () => 'prod-mini';
    const host = await fleet.resolve({ pin: '' });
    expect(host.id).toBe('local-w');
    expect(host.local).toBe(true);
  });
});

describe('TaskService.mergeEnvSecrets', () => {
  test('resolves conductorProxy (does not skip with Cannot find module)', async () => {
    const { TaskService } = require('../../api/services/TaskService');
    const svc = new TaskService({ Task: {}, docker: {}, fleet: {} });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const out = await svc.mergeEnvSecrets('p', 'prod', { FOO: '1' });
    expect(out.FOO).toBe('1');
    const skipped = warn.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(skipped).not.toMatch(/Cannot find module/);
    warn.mockRestore();
  });
});
