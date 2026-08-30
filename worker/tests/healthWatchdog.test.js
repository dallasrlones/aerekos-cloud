'use strict';

const { HealthWatchdog } = require('../shared/healthWatchdog');

describe('HealthWatchdog', () => {
  test('restarts after N consecutive failed probes', async () => {
    const restarts = [];
    const events = [];
    const wd = new HealthWatchdog({
      failThreshold: 2,
      maxRestarts: 3,
      probe: async () => false,
      restart: async (t) => { restarts.push(t.service); },
      onEvent: (name, t) => events.push({ name, service: t.service }),
    });
    const targets = [{ service: 'queue_manager', projectId: 'p1' }];
    await wd.tick(targets);
    expect(restarts).toHaveLength(0);
    await wd.tick(targets);
    expect(restarts).toEqual(['queue_manager']);
    expect(events.some((e) => e.name === 'service:unhealthy')).toBe(true);
  });

  test('SKIP_HEAL skips work', async () => {
    process.env.SKIP_HEAL = '1';
    const wd = new HealthWatchdog({ probe: async () => false, restart: async () => { throw new Error('no'); } });
    const r = await wd.tick([{ service: 'x' }]);
    delete process.env.SKIP_HEAL;
    expect(r.skipped).toBe(true);
  });

  test('marks degraded after max restarts in window', async () => {
    let t = 0;
    const wd = new HealthWatchdog({
      failThreshold: 1,
      maxRestarts: 2,
      windowMs: 10000,
      now: () => t,
      probe: async () => false,
      restart: async () => {},
    });
    const targets = [{ service: 'download_manager' }];
    await wd.tick(targets);
    t += 1;
    await wd.tick(targets);
    t += 1;
    const r = await wd.tick(targets);
    expect(r.actions.some((a) => a.action === 'degraded')).toBe(true);
  });
});
