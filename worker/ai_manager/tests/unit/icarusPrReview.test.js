'use strict';

const { PrReviewService } = require('../../api/services/PrReviewService');

describe('PrReviewService — coding creates, higher model approves', () => {
  let svc;
  const agent = {
    id: 'ag-1',
    intelligence: 'icarus-worker',
    options: {
      lane_intelligence: {
        user: 'icarus-user',
        manager: 'icarus-manager',
        review: 'icarus-manager',
        worker: 'icarus-worker',
        coding: 'icarus-worker',
      },
    },
  };

  beforeEach(() => {
    svc = new PrReviewService();
  });

  test('openFromWorker marks awaiting_review and created_by coding_agent', () => {
    const pr = svc.openFromWorker({
      projectId: 'p1',
      agent,
      workerId: 'w1',
      title: 'feat: x',
      files: ['a.js'],
      diff: '+ console.log(1)\n',
    });
    expect(pr.status).toBe('awaiting_review');
    expect(pr.created_by).toBe('coding_agent');
    expect(svc.list('p1')).toHaveLength(1);
  });

  test('heuristic rejects secrets in diff', () => {
    const pr = svc.openFromWorker({
      projectId: 'p1',
      agent,
      title: 'bad',
      files: ['.env'],
      diff: 'AWS_SECRET=abc BEGIN RSA PRIVATE KEY',
    });
    const h = svc.heuristicReview(pr);
    expect(h.verdict).toBe('reject');
  });

  test('approveWithHigherModel uses manager intel not coding worker', async () => {
    const submitted = [];
    svc.jobs = {
      submit: async (projectId, body) => {
        submitted.push(body);
        return { id: 'job-1' };
      },
    };
    const pr = svc.openFromWorker({
      projectId: 'p1',
      agent,
      title: 'ok',
      files: ['x.js'],
      diff: '+ export const x = 1\n',
    });
    const out = await svc.approveWithHigherModel({
      projectId: 'p1', agent, prId: pr.id, settings: {},
    });
    expect(out.review.intelligence).toBe('icarus-manager');
    expect(out.review.intelligence).not.toBe('icarus-worker');
    if (submitted.length) {
      expect(submitted[0].intelligence).toBe('icarus-manager');
      expect(submitted[0].lane).toBe('manager');
    }
  });

  test('markMerged refuses until approved', () => {
    const pr = svc.openFromWorker({
      projectId: 'p1', agent, title: 'x', files: ['a'], diff: '+a\n',
    });
    expect(() => svc.markMerged(pr.id)).toThrow(/higher-model/i);
  });

  test('applyModelResult maps verdicts', () => {
    const pr = svc.openFromWorker({
      projectId: 'p1', agent, title: 'x', files: ['a'], diff: '+a\n',
    });
    svc.applyModelResult(pr.id, '{"verdict":"approve","summary":"lgtm","issues":[]}');
    expect(svc.get(pr.id).status).toBe('approved');
    const ask = svc.userAskPayload(svc.get(pr.id));
    expect(ask.options).toContain('Merge');
  });

  test('user Merge ask only after approve', async () => {
    const pr = svc.openFromWorker({
      projectId: 'p1', agent, title: 'good', files: ['a.js'], diff: '+ok\n',
    });
    // no jobs → heuristic path → approved
    const out = await svc.approveWithHigherModel({
      projectId: 'p1', agent, prId: pr.id, settings: {},
    });
    expect(out.status).toBe('approved');
    const ask = svc.userAskPayload(out);
    expect(ask.kind).toBe('pr_merge');
    expect(ask.options).toEqual(['Merge', 'Request changes', 'Reject']);
    expect(svc.markMerged(pr.id).status).toBe('merged');
  });
});
