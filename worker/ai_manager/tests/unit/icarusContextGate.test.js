'use strict';

const {
  UserContextGate, classify, dualStreamPolicy, ROUTES,
} = require('../../api/services/UserContextGate');

describe('UserContextGate dual-stream', () => {
  test('classifies CHAT / WEB / DIG / MANAGER / STEER', () => {
    expect(classify('hey how are you').route).toBe('CHAT');
    expect(classify('search for neo4j ready set docs').route).toBe('WEB');
    expect(classify('read the AgentGateway file').route).toBe('DIG');
    expect(classify('implement the deploy pipeline').route).toBe('MANAGER');
    expect(classify('pause browse and do X first', { hasLivePlan: true }).route).toBe('STEER');
  });

  test('STEER only when live plan', () => {
    expect(classify('do this first', { hasLivePlan: false }).route).not.toBe('STEER');
  });

  test('dualStreamPolicy never blocks user on CHAT/WEB/DIG/STEER', () => {
    for (const route of ['CHAT', 'WEB', 'DIG', 'STEER']) {
      const p = dualStreamPolicy(route);
      expect(p.user_immediate).toBe(true);
      expect(p.manager_continues).toBe(true);
    }
    const mgr = dualStreamPolicy('MANAGER');
    expect(mgr.wake_manager).toBe(true);
    expect(mgr.user_immediate).toBe(true);
  });

  test('gate.route returns policy + timestamp', async () => {
    const gate = new UserContextGate();
    const out = await gate.route('build a new project');
    expect(ROUTES).toContain(out.route);
    expect(out.policy).toBeTruthy();
    expect(out.at).toBeGreaterThan(0);
  });

  test('low-confidence can escalate to llmClassify', async () => {
    const gate = new UserContextGate({
      llmClassify: async () => ({ route: 'MANAGER', confidence: 0.9 }),
    });
    // empty → clarify with low confidence → llm
    const out = await gate.route('');
    expect(out.route).toBe('MANAGER');
    expect(out.source).toBe('llm');
  });
});
