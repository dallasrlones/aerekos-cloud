'use strict';

jest.mock('../../api/models', () => ({
  PlatformJob: {
    create: jest.fn(async (row) => ({ id: 'j1', created_at: '2026-01-01T00:00:00Z', ...row })),
    findAll: jest.fn(async () => []),
    delete: jest.fn(async () => {}),
  },
}));

const mockBroadcastToFrontend = jest.fn();
jest.mock('../../api/services/WorkerSocketService', () => ({
  broadcastToFrontend: (...args) => mockBroadcastToFrontend(...args),
}));

const { PlatformJob } = require('../../api/models');
const JobService = require('../../api/services/JobService');

describe('JobService socket fanout', () => {
  beforeEach(() => {
    mockBroadcastToFrontend.mockClear();
    PlatformJob.create.mockClear();
    PlatformJob.delete.mockClear();
    PlatformJob.findAll.mockReset();
  });

  test('create broadcasts job:updated', async () => {
    const job = await JobService.create({ project_id: 'p1', kind: 'updates-pause', summary: 'pause fleet' });
    expect(job.id).toBe('j1');
    expect(mockBroadcastToFrontend).toHaveBeenCalledWith('job:updated', expect.objectContaining({
      action: 'created',
      project_id: 'p1',
      job: expect.objectContaining({ id: 'j1', kind: 'updates-pause' }),
    }));
  });

  test('del broadcasts deleted', async () => {
    PlatformJob.findAll.mockResolvedValue([{ id: 'j1', project_id: 'p1' }]);
    await JobService.del('j1');
    expect(mockBroadcastToFrontend).toHaveBeenCalledWith('job:updated', expect.objectContaining({
      action: 'deleted',
      project_id: 'p1',
      job: expect.objectContaining({ id: 'j1' }),
    }));
  });
});
