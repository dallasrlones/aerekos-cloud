'use strict';

const {
  LayaDecisionService, FLOW_SLOTS,
} = require('../../api/services/LayaDecisionService');

describe('LayaDecisionService', () => {
  const laya = new LayaDecisionService();

  test('lane talk vs manager', async () => {
    const talk = await laya.routeLane('hey how are you');
    expect(talk.lane_choice).toBe('talk');
    const mgr = await laya.routeLane('build an api and deploy it');
    expect(['manager', 'talk']).toContain(mgr.lane_choice);
    expect(mgr.route).toBeDefined();
  });

  test('flow_pick new project', async () => {
    const out = await laya.predict(
      { text: 'create a new app with models' },
      { flow_pick: {} },
    );
    expect(out.answers.flow_pick.choice).toBe('new_project_app');
  });

  test('intake_next ready when slots filled', async () => {
    const slots = {
      intent: 'todo app', models: 'Task', db: 'SQLite', domain: 'todo.example.com',
    };
    const ask = laya.intakeAsk('new_project_app', slots);
    expect(ask.ready).toBe(true);
  });

  test('intake_next asks for missing field', () => {
    const ask = laya.intakeAsk('new_project_app', { intent: 'x' });
    expect(ask.ready).toBe(false);
    expect(ask.field).toBe('models');
  });

  test('hitl deny prod-ish', async () => {
    const out = await laya.predict(
      { toolName: 'destroy_prod', text: 'wipe prod' },
      { hitl_risk: {} },
    );
    expect(out.answers.hitl_risk.choice).toBe('deny');
  });

  test('flow slots exist', () => {
    expect(FLOW_SLOTS.new_project_app.required).toContain('domain');
    expect(FLOW_SLOTS.new_worker_fleet.required).toContain('engine');
    expect(FLOW_SLOTS.iac_spool.required).toContain('intent');
    expect(FLOW_SLOTS.safe_self_update.required).toContain('goal');
    expect(FLOW_SLOTS.safe_deps_upgrade.required).toContain('tree');
  });

  test('mergeSlots extracts domain', () => {
    const slots = laya.mergeSlots('new_project_app', { intent: 'x', models: 'y', db: 'SQLite' }, 'app.example.com');
    expect(slots.domain).toMatch(/example\.com/);
  });

  test('safe_self_update intakeAsk', () => {
    const ask = laya.intakeAsk('safe_self_update', { claim: 'aerekos-cloud' });
    expect(ask.ready).toBe(false);
    expect(ask.field).toBe('goal');
    const ready = laya.intakeAsk('safe_self_update', { claim: 'aerekos-cloud', goal: 'fix chat' });
    expect(ready.ready).toBe(true);
  });
});
