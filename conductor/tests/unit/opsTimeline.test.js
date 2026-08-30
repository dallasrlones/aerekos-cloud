'use strict';

const OpsTimelineService = require('../../api/services/OpsTimelineService');
const FleetHealthService = require('../../api/services/FleetHealthService');

describe('OpsTimelineService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('aggregates worker-down events', async () => {
    jest.spyOn(FleetHealthService, 'snapshot').mockResolvedValue({
      workers: [
        { id: 'w1', hostname: 'dead', status: 'offline', last_seen: '2026-01-01T00:00:00Z' },
        { id: 'w2', hostname: 'ok', status: 'online' },
      ],
    });
    const tl = await OpsTimelineService.timeline('p1');
    expect(tl.project_id).toBe('p1');
    expect(tl.broken).toBeGreaterThanOrEqual(1);
    expect(tl.events.some((e) => e.kind === 'worker')).toBe(true);
  });

  test('empty snapshot still returns shape', async () => {
    jest.spyOn(FleetHealthService, 'snapshot').mockResolvedValue({ workers: [] });
    const tl = await OpsTimelineService.timeline(null);
    expect(tl).toEqual(expect.objectContaining({
      project_id: null,
      broken: expect.any(Number),
      events: expect.any(Array),
    }));
  });
});
