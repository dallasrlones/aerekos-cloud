'use strict';

const {
  createGateway, scoreJob, LANE_TO_CLASS, CLASS_PRIORITY,
} = require('../../api/services/AgentGateway');

describe('AgentGateway P0–P5 + aging + reserved user', () => {
  test('legacy: serializes to maxConcurrent=1 and user jumps the queue', async () => {
    const order = [];
    const gw = createGateway({ maxConcurrent: 1 });
    let unlock;
    const hold = new Promise((r) => { unlock = r; });
    const pExec = gw.enqueue('execute', async () => {
      order.push('exec-start');
      await hold;
      order.push('exec-end');
      return 'e';
    });
    await new Promise((r) => setImmediate(r));
    const pUser = gw.enqueue('user', async () => {
      order.push('user');
      return 'u';
    });
    unlock();
    await Promise.all([pExec, pUser]);
    expect(order[0]).toBe('exec-start');
    expect(order).toContain('user');
    expect(gw.snapshot().max_concurrent).toBe(1);
  });

  test('review lane maps to class 2 (above coding execute)', () => {
    expect(LANE_TO_CLASS.review).toBe(2);
    expect(LANE_TO_CLASS.execute).toBe(3);
    expect(CLASS_PRIORITY[2]).toBeLessThan(CLASS_PRIORITY[3]);
  });

  test('scoreJob prefers higher class and ages waiting jobs', () => {
    const now = 1_000_000;
    const fresh = {
      lane: 'execute', priorityClass: 3, taskPriority: 0, enqueuedAt: now,
    };
    const aged = {
      lane: 'execute', priorityClass: 3, taskPriority: 0, enqueuedAt: now - 90_000,
    };
    const user = {
      lane: 'user', priorityClass: 1, taskPriority: 0, enqueuedAt: now,
    };
    expect(scoreJob(user, now)).toBeLessThan(scoreJob(fresh, now));
    expect(scoreJob(aged, now)).toBeLessThan(scoreJob(fresh, now));
  });

  test('reserved user slots keep capacity when execute floods', async () => {
    const gw = createGateway({ maxConcurrent: 2, reservedUserSlots: 1 });
    let unlockExec;
    const hold = new Promise((r) => { unlockExec = r; });
    const started = [];
    const p1 = gw.enqueue('execute', async () => {
      started.push('e1');
      await hold;
    }, { priorityClass: 3 });
    await new Promise((r) => setImmediate(r));
    const p2 = gw.enqueue('execute', async () => {
      started.push('e2');
      await hold;
    }, { priorityClass: 3 });
    await new Promise((r) => setImmediate(r));
    // With 1 reserved for user, second execute may wait while user can start
    const pUser = gw.enqueue('user', async () => {
      started.push('user');
    }, { priorityClass: 1 });
    await new Promise((r) => setImmediate(r));
    expect(started).toContain('e1');
    expect(started).toContain('user');
    unlockExec();
    await Promise.all([p1, p2, pUser]);
    expect(gw.snapshot().reserved_user_slots).toBe(1);
  });

  test('snapshot exposes priority_class and scores', async () => {
    const gw = createGateway({ maxConcurrent: 1 });
    let unlock;
    const hold = new Promise((r) => { unlock = r; });
    const p = gw.enqueue('execute', async () => hold, { priorityClass: 3, taskPriority: 2 });
    await new Promise((r) => setImmediate(r));
    gw.enqueue('manager', async () => {}, { priorityClass: 2 });
    const snap = gw.snapshot();
    expect(snap.in_flight.length).toBe(1);
    expect(snap.queued.length).toBeGreaterThanOrEqual(1);
    expect(snap.queued[0]).toHaveProperty('priority_class');
    expect(snap.queued[0]).toHaveProperty('score');
    unlock();
    await p;
  });

  test('configure updates concurrency and reserved slots', () => {
    const gw = createGateway({ maxConcurrent: 1, reservedUserSlots: 1 });
    gw.configure({ maxConcurrent: 4, reservedUserSlots: 2 });
    const snap = gw.snapshot();
    expect(snap.max_concurrent).toBe(4);
    expect(snap.reserved_user_slots).toBe(2);
  });
});
