jest.mock('../../api/services/WorkerSocketService', () => ({
  isWorkerConnected: jest.fn(),
  requestFromWorker: jest.fn(),
  broadcastToFrontend: jest.fn(),
}));
jest.mock('../../api/services/WorkerService', () => ({
  getWorker: jest.fn(),
  updateResources: jest.fn(),
}));
jest.mock('../../api/services/AuditService', () => ({
  log: jest.fn().mockResolvedValue({}),
}));

const HostService = require('../../api/services/HostService');
const WorkerSocketService = require('../../api/services/WorkerSocketService');
const WorkerService = require('../../api/services/WorkerService');
const AuditService = require('../../api/services/AuditService');

describe('HostService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    WorkerService.getWorker.mockResolvedValue({
      id: 'w1',
      resources: { cpu_cores: 4 },
    });
    WorkerService.updateResources.mockResolvedValue({});
    WorkerSocketService.isWorkerConnected.mockReturnValue(true);
  });

  test('check rejects when worker is offline', async () => {
    WorkerSocketService.isWorkerConnected.mockReturnValue(false);
    await expect(HostService.check('w1')).rejects.toMatchObject({
      status: 503,
      message: 'Worker is offline',
    });
  });

  test('check requests host:check and persists host', async () => {
    WorkerSocketService.requestFromWorker.mockResolvedValue({
      requestId: 'r1',
      ok: true,
      os: { supported: true, updates_available: 2 },
      docker: { supported: true, updates_available: 0 },
      probed_at: '2026-08-28T00:00:00.000Z',
    });

    const result = await HostService.check('w1');
    expect(WorkerSocketService.requestFromWorker).toHaveBeenCalledWith(
      'w1',
      'host:check',
      {},
      'host:check:result',
      expect.any(Number)
    );
    expect(result.os.updates_available).toBe(2);
    expect(WorkerService.updateResources).toHaveBeenCalled();
    expect(AuditService.log).not.toHaveBeenCalled();
  });

  test('update rejects invalid target', async () => {
    await expect(HostService.update('w1', 'firmware')).rejects.toMatchObject({
      status: 400,
    });
    expect(WorkerSocketService.requestFromWorker).not.toHaveBeenCalled();
  });

  test('update audits and requests host:update', async () => {
    WorkerSocketService.requestFromWorker.mockResolvedValue({
      requestId: 'r2',
      ok: true,
      target: 'os',
      reboot_required: true,
      after: { os: { supported: true, updates_available: 0 }, docker: { supported: true, updates_available: 0 } },
    });

    const result = await HostService.update('w1', 'os', { actorId: 'u1' });
    expect(WorkerSocketService.requestFromWorker).toHaveBeenCalledWith(
      'w1',
      'host:update',
      { target: 'os' },
      'host:update:result',
      expect.any(Number)
    );
    expect(result.reboot_required).toBe(true);
    expect(AuditService.log).toHaveBeenCalled();
    expect(AuditService.log.mock.calls.some((c) => c[0].action === 'host.update')).toBe(true);
  });
});
