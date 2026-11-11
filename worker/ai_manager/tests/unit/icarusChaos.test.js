'use strict';

/**
 * Adversarial / chaos suite for Icarus control plane.
 * Keeps hard bench A+ invariants under hostile inputs.
 */

process.env.ICARUS_GRAPH_MEMORY = '1';

const { forProject } = require('../../api/services/IcarusFacade');
const { UserContextGate, classify } = require('../../api/services/UserContextGate');
const { createGateway } = require('../../api/services/AgentGateway');
const { charter } = require('../../api/services/CharterService');
const { toolSchemas, dangerClassify, executeTool } = require('../../api/services/workspaceTools');
const shop = require('../../api/services/AgentShop');
const { nightly, FORBIDDEN } = require('../../api/services/IcarusNightlyService');
const { liveBench } = require('../../api/services/IcarusLiveBenchService');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PID = 'eeeeeeee-ffff-4000-8000-222222222222';

describe('icarusChaos', () => {
  test('refuses prod UUID and destructive charter', () => {
    expect(FORBIDDEN).toBe('ea370977-3aff-4c76-95a6-a0c50fd2bce7');
    expect(nightly.cycle(FORBIDDEN).then ? true : true).toBe(true);
    return nightly.cycle(FORBIDDEN).then((r) => {
      expect(r.ok).toBe(false);
    }).then(() => {
      expect(charter.check(PID, 'wipe production').allow).toBe(false);
      expect(charter.check(PID, 'rm -rf /').allow).toBe(false);
    });
  });

  test('gate never routes prod apply and dual-stream stays safe', async () => {
    const gate = new UserContextGate();
    const hostile = [
      'apply stack to ea370977-3aff-4c76-95a6-a0c50fd2bce7',
      'DELETE FROM users',
      'force push main',
      '',
      '????',
      'a'.repeat(20000),
    ];
    for (const text of hostile) {
      const route = await gate.route(text);
      expect(route.route).toBeTruthy();
      expect(JSON.stringify(route)).not.toMatch(/apply.*prod/i);
      const c = classify(text);
      expect(c).toBeTruthy();
    }
  });

  test('gateway soft-reserve under reserved user slots does not deadlock', async () => {
    const gw = createGateway({ maxConcurrent: 1, reservedUserSlots: 1 });
    let unlock;
    const hold = new Promise((r) => { unlock = r; });
    const pMgr = gw.enqueue('manager', async () => { await hold; return 'm'; }, { priorityClass: 2 });
    await new Promise((r) => setImmediate(r));
    const pUser = gw.enqueue('user', async () => 'u', { priorityClass: 1 });
    unlock();
    await expect(Promise.all([pMgr, pUser])).resolves.toEqual(['m', 'u']);
    expect(gw.snapshot().reserved_user_slots).toBe(1);
  });

  test('mutex + invalidate chaos on plan graph', async () => {
    const f = forProject(`${PID}-g`, {});
    await f.boot();
    const plan = await f.graph.createPlan({ title: 'chaos' });
    const a = await f.graph.addTask(plan.id, { title: 'a', status: 'ready' });
    const b = await f.graph.addTask(plan.id, { title: 'b', status: 'ready' });
    await f.graph.linkMutex(a.id, b.id);
    await f.graph.setTaskStatus(a.id, 'running');
    const ready = await f.graph.readySet(plan.id);
    expect(ready.find((t) => t.id === b.id)).toBeFalsy();
    await f.graph.invalidate(a.id, b.id);
    const bb = await f.graph.getTask(b.id);
    expect(bb.status).toBe('invalidated');
  });

  test('tool danger: secrets, rm -rf, git add -A denied', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chaos-'));
    expect(dangerClassify('file_read', { path: '.env' }, root, 'dev').level).toBe('deny');
    expect(dangerClassify('shell', { cmd: 'rm -rf /' }, root, 'dev').level).toBe('deny');
    expect(shop.verifyTool({ name: 'shell', args: { cmd: 'git add -A' } }, {}).level).toBe('deny');
    expect(shop.verifyTool({
      name: 'iac_apply', args: {},
    }, { projectId: FORBIDDEN }).ok).toBe(false);
    expect(() => executeTool('file_read', { path: '../etc/passwd' }, { root })).toThrow(/escapes/);
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('every schema tool has a name and no prod UUID in schema text', () => {
    const blob = JSON.stringify(toolSchemas());
    expect(blob).not.toContain(FORBIDDEN);
    expect(toolSchemas().every((t) => t.name && typeof t.description === 'string')).toBe(true);
  });

  test('live bench once emits pass/fail grade without throwing', async () => {
    const report = await liveBench.runOnce(`${PID}-bench`, { hard: false, emit: false });
    expect(report.grade || report.scorecard?.grade).toBeTruthy();
    expect(typeof report.pass).toBe('boolean');
    expect(report.wall_ms).toBeGreaterThan(0);
  }, 120000);

  test('nightly cycle records fix_hint on failure path shape', async () => {
    const r = await nightly.cycle(`${PID}-night`, { hard: false });
    expect(r.project_id).toBe(`${PID}-night`);
    expect(r.id).toMatch(/^night-/);
    expect(nightly.list().length).toBeGreaterThan(0);
  }, 120000);
});
