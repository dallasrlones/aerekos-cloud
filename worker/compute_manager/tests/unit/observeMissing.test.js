'use strict';

jest.mock('../../api/models', () => ({ Task: {} }));
jest.mock('../../api/services/DockerService', () => ({ DockerService: jest.fn() }));
jest.mock('../../api/services/FleetExec', () => ({ FleetExec: jest.fn() }));
jest.mock('../../../shared/conductorProxy', () => ({ proxy: jest.fn() }));

const { ObserveShipper } = require('../../api/services/ObserveShipper');

describe('ObserveShipper missing containers', () => {
  test('marks a vanished container stopped instead of looping 404s', async () => {
    const gone = Object.assign(new Error('no such container'), { statusCode: 404 });
    const updates = [];
    const shipper = new ObserveShipper({
      tasks: {
        Task: { update: async (id, patch) => updates.push({ id, ...patch }) },
        listRunning: async () => [{
          id: 'ghost',
          project_id: 'p1',
          container_id: 'deadbeef',
          status: 'running',
        }],
      },
      docker: {
        logs: async () => { throw gone; },
        stats: async () => { throw gone; },
      },
    });
    shipper.timer = null;
    await shipper.tick();
    expect(updates).toEqual([
      { id: 'ghost', status: 'stopped', error_message: 'container not found' },
      { id: 'ghost', status: 'stopped', error_message: 'container not found' },
    ]);
  });
});
