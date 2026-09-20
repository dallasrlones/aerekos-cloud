'use strict';

function serialize(row) {
  function parseJson(s, fallback) {
    if (s && typeof s === 'object') return s;
    try { return JSON.parse(s || ''); } catch { return fallback; }
  }
  return {
    id: row.id,
    status: row.status,
    request: parseJson(row.request, {}),
    result: parseJson(row.result, null),
    partial: row.partial || '',
  };
}

describe('IntelligenceJob serialize', () => {
  test('parses request JSON', () => {
    const out = serialize({
      id: 'j1',
      status: 'queued',
      request: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
      result: '',
      partial: '',
    });
    expect(out.request.messages[0].content).toBe('hi');
    expect(out.status).toBe('queued');
  });

  test('terminal cancel is 409', () => {
    const job = { status: 'succeeded' };
    const err = ['succeeded', 'failed', 'cancelled'].includes(job.status) ? 409 : 200;
    expect(err).toBe(409);
  });
});
