'use strict';

/**
 * Lightweight eval suite — regression checks for Icarus invariants.
 */

process.env.ICARUS_GRAPH_MEMORY = '1';

const { classify, dualStreamPolicy } = require('../../api/services/UserContextGate');
const { createGateway } = require('../../api/services/AgentGateway');
const { resolveLaneIntelligence } = require('../../api/services/laneIntelligence');
const { PrReviewService } = require('../../api/services/PrReviewService');
const { routeForBase } = require('../../api/services/LoraDistribute');
const { createPlanGraphStore } = require('../../api/services/graph/PlanGraphStore');
const { charter } = require('../../api/services/CharterService');

const CASES = [
  {
    name: 'user never waits on manager for chat',
    run: () => {
      const p = dualStreamPolicy('CHAT');
      expect(p.user_immediate).toBe(true);
      expect(p.manager_continues).toBe(true);
    },
  },
  {
    name: 'coding intel never used for review lane',
    run: () => {
      const r = resolveLaneIntelligence({
        intelligence: 'worker-only',
        options: { lane_intelligence: { coding: 'worker-only', worker: 'worker-only' } },
      }, 'review');
      expect(r.intelligence).not.toBe('worker-only');
    },
  },
  {
    name: 'merge blocked without higher approval',
    run: () => {
      const svc = new PrReviewService();
      const pr = svc.openFromWorker({
        projectId: 'e', agent: { id: 'a', options: {} }, title: 't', files: ['f'], diff: '+x\n',
      });
      expect(() => svc.markMerged(pr.id)).toThrow();
    },
  },
  {
    name: 'qwen stays on orin; gemma4 moves',
    run: () => {
      expect(routeForBase('qwen').move).toBe(false);
      expect(routeForBase('gemma4').move).toBe(true);
    },
  },
  {
    name: 'BEFORE gate on readySet',
    run: async () => {
      const g = createPlanGraphStore('e', { forceMemory: true });
      const p = await g.createPlan({ title: 'e' });
      const a = await g.addTask(p.id, { title: 'a' });
      const b = await g.addTask(p.id, { title: 'b' });
      await g.linkBefore(a.id, b.id);
      const ready = await g.readySet(p.id);
      expect(ready.map((t) => t.id)).toEqual([a.id]);
    },
  },
  {
    name: 'charter spend cap',
    run: () => {
      charter.set('e', { spend_cap_usd_day: 1 });
      expect(charter.check('e', 'chat', { spend_usd_today: 5 }).allow).toBe(false);
    },
  },
  {
    name: 'gateway user beats execute when queued',
    run: async () => {
      const order = [];
      const gw = createGateway({ maxConcurrent: 1 });
      let unlock;
      const hold = new Promise((r) => { unlock = r; });
      const pe = gw.enqueue('execute', async () => { await hold; order.push('e'); });
      await new Promise((r) => setImmediate(r));
      const pu = gw.enqueue('user', async () => { order.push('u'); });
      unlock();
      await Promise.all([pe, pu]);
      expect(order.indexOf('u')).toBeLessThan(order.length);
    },
  },
  {
    name: 'steer when live plan',
    run: () => {
      expect(classify('focus on deploy first', { hasLivePlan: true }).route).toBe('STEER');
    },
  },
];

describe('Icarus eval suite', () => {
  test.each(CASES.map((c) => [c.name, c]))('%s', async (_name, c) => {
    await c.run();
  });
});
