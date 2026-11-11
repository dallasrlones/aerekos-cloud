'use strict';

const OpsTimelineService = require('../../api/services/OpsTimelineService');
const FleetHealthService = require('../../api/services/FleetHealthService');
const JobService = require('../../api/services/JobService');

describe('OpsTimelineService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('offline workers are warnings, not broken', async () => {
    jest.spyOn(FleetHealthService, 'snapshot').mockResolvedValue({
      workers: [
        { id: 'w1', hostname: 'dead', status: 'offline', last_seen: '2026-01-01T00:00:00Z' },
        { id: 'w2', hostname: 'ok', status: 'online' },
      ],
    });
    const tl = await OpsTimelineService.timeline('p1');
    expect(tl.project_id).toBe('p1');
    expect(tl.broken).toBe(0);
    const offline = tl.events.find((e) => e.kind === 'worker' && e.ref?.worker_id === 'w1');
    expect(offline).toEqual(expect.objectContaining({
      severity: 'warning',
      title: 'dead is offline',
    }));
  });

  test('degraded workers count as broken', async () => {
    jest.spyOn(FleetHealthService, 'snapshot').mockResolvedValue({
      workers: [
        { id: 'w1', hostname: 'sick', status: 'degraded', last_seen: '2026-01-01T00:00:00Z' },
        { id: 'w2', hostname: 'ok', status: 'online' },
      ],
    });
    const tl = await OpsTimelineService.timeline('p1');
    expect(tl.broken).toBe(1);
    expect(tl.events.some((e) => e.severity === 'error' && e.title.includes('degraded'))).toBe(true);
  });

  test('failed jobs increment broken', async () => {
    jest.spyOn(FleetHealthService, 'snapshot').mockResolvedValue({ workers: [] });
    JobService.listRecent = jest.fn().mockResolvedValue([
      {
        id: 'j1',
        status: 'failed',
        kind: 'deploy',
        summary: 'deploy failed',
        created_at: '2026-01-02T00:00:00Z',
      },
    ]);
    const tl = await OpsTimelineService.timeline('p1');
    expect(tl.broken).toBe(1);
    expect(tl.events.some((e) => e.title === 'deploy failed')).toBe(true);
  });

  test('empty snapshot still returns shape', async () => {
    jest.spyOn(FleetHealthService, 'snapshot').mockResolvedValue({ workers: [] });
    delete JobService.listRecent;
    const tl = await OpsTimelineService.timeline(null);
    expect(tl).toEqual(expect.objectContaining({
      project_id: null,
      broken: expect.any(Number),
      events: expect.any(Array),
    }));
  });
});
