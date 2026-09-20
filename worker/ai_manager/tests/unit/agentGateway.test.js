'use strict';

const { createGateway } = require('../../api/services/AgentGateway');

describe('AgentGateway', () => {
  test('serializes to maxConcurrent=1 and user jumps the queue', async () => {
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
});
