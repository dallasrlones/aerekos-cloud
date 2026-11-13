'use strict';

/**
 * Golden eval harness cases for W18 Icarus safety gates (CI regression).
 */

process.env.ICARUS_GRAPH_MEMORY = '1';

const { planInfoVerify } = require('../../api/services/InfoVerifyGate');
const { layaDecision, LayaDecisionService } = require('../../api/services/LayaDecisionService');

describe('Icarus eval harness (W18 gates)', () => {
  test('InfoVerifyGate required when factual + low RAG', async () => {
    const plan = await planInfoVerify({
      text: 'What is the latest Node LTS version?',
      projectId: 'eval-p',
      agent: { rag_collection: 'skills' },
      gate: { lane_choice: 'info', policy: { info_lane: true } },
      ragSearch: async () => ({ items: [{ score: 0.05 }] }),
      laya: {
        predict: async () => ({
          answers: {
            info_path: { choice: 'rag', confidence: 0.8 },
            learn_disposition: { choice: 'skip', confidence: 0.7 },
          },
        }),
      },
    });
    expect(plan.required).toBe(true);
    expect(['low_rag', 'factual_verify', 'laya_fetch']).toContain(plan.reason);
  });

  test('Done-Gate blocks complete when work is incomplete', async () => {
    const laya = new LayaDecisionService();
    const out = await laya.predict(
      { prOpened: false, checksOk: false, replanCount: 0 },
      { done_gate: {} },
    );
    expect(out.answers.done_gate.choice).not.toBe('complete');
    expect(out.answers.done_gate.choice).toBe('retry');
  });

  test('Done-Gate allows complete only when PR + checks green', async () => {
    const laya = new LayaDecisionService();
    const out = await laya.predict(
      { prOpened: true, checksOk: true },
      { done_gate: {} },
    );
    expect(out.answers.done_gate.choice).toBe('complete');
  });

  test('Context-Gate routes thin context to ask_human', async () => {
    const out = await layaDecision.predict(
      { hasEnoughContext: false, canSelfFetch: false, text: 'do the thing' },
      { context_gate: {} },
    );
    expect(out.answers.context_gate.choice).toBe('ask_human');
  });

  test('Context-Gate self_fetch when thin but fetchable', async () => {
    const out = await layaDecision.predict(
      { hasEnoughContext: false, canSelfFetch: true, text: 'look up docs' },
      { context_gate: {} },
    );
    expect(out.answers.context_gate.choice).toBe('self_fetch');
  });
});
