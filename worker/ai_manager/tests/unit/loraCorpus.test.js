'use strict';

const { LoraTrainService } = require('../../api/services/LoraTrainService');

describe('LoRA corpus dataset builder', () => {
  test('recordCorpusRow and buildDatasetFromCorpus produce JSONL', () => {
    const svc = new LoraTrainService();
    const pid = 'proj-1';
    svc.recordCorpusRow(pid, {
      hash: 'abc',
      prefix: 'icarus/corpus/2026-01-01/abc',
      url: 'https://example.com',
      prompt: 'What is X?',
      normalized: 'X is verified.',
    });
    const jsonl = svc.buildDatasetFromCorpus(pid, { agentKind: 'coding' });
    expect(jsonl).toMatch(/corpus_hash/);
    expect(jsonl).toMatch(/What is X/);
    const job = svc.enqueueFromCorpus({
      projectId: pid,
      agentKind: 'coding',
      adapterName: 'corpus-tools',
    });
    expect(job.dataset_source).toBe('corpus');
    expect(job.dataset_bytes).toBeGreaterThan(20);
  });
});
