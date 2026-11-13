'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');

const {
  looksFactual, planInfoVerify, executeInfoVerify,
} = require('../../api/services/InfoVerifyGate');
const { CorpusStore } = require('../../api/services/CorpusStore');

describe('InfoVerifyGate', () => {
  test('looksFactual detects questions and risky claims', () => {
    expect(looksFactual('When was PostgreSQL 16 released?')).toBe(true);
    expect(looksFactual('hey')).toBe(false);
    expect(looksFactual('The CEO was born in 1980')).toBe(true);
  });

  test('planInfoVerify requires fetch when RAG score is low', async () => {
    const plan = await planInfoVerify({
      text: 'What is the latest LTS Node version?',
      projectId: 'p1',
      agent: { rag_collection: 'icarus-skills' },
      gate: { lane_choice: 'info', policy: { info_lane: true } },
      ragSearch: async () => ({ items: [{ score: 0.1, text: 'stale' }] }),
      laya: {
        predict: async () => ({
          answers: {
            info_path: { choice: 'rag', confidence: 0.7 },
            learn_disposition: { choice: 'skip', confidence: 0.6 },
          },
        }),
      },
    });
    expect(plan.required).toBe(true);
    expect(plan.reason).toBe('low_rag');
  });

  test('planInfoVerify follows Laya web_fetch disposition', async () => {
    const plan = await planInfoVerify({
      text: 'Look up the docs for DuckDB',
      projectId: 'p1',
      agent: {},
      gate: {},
      ragSearch: async () => ({ items: [{ score: 0.9 }] }),
      laya: {
        predict: async () => ({
          answers: {
            info_path: { choice: 'web_fetch', confidence: 0.8 },
            learn_disposition: { choice: 'fetch_only', confidence: 0.7 },
          },
        }),
      },
    });
    expect(plan.required).toBe(true);
    expect(plan.reason).toBe('laya_fetch');
  });

  test('executeInfoVerify stores corpus and returns appendix', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ivg-'));
    process.env.AI_MANAGER_DATA = tmp;
    process.env.CORPUS_LOCAL_ONLY = '1';
    const store = new CorpusStore({ root: path.join(tmp, 'corpus') });
    const out = await executeInfoVerify({
      text: 'What is Aerekos?',
      projectId: 'pid',
      agent: { storage_bucket: 'icarus-agent' },
      store,
      webSearch: async () => ({
        ok: true,
        results: [{ title: 'Example', url: 'https://example.com/a' }],
      }),
      webFetch: async () => ({
        ok: true,
        text: '<html><body>verified fact</body></html>',
      }),
    });
    expect(out.ok).toBe(true);
    expect(out.corpus.hash).toBeTruthy();
    expect(out.appendix).toMatch(/never invent/i);
    expect(out.appendix).toMatch(/verified fact/i);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
