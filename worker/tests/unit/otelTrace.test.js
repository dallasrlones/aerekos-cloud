'use strict';

const {
  readTraceParent,
  traceparentFromRequestId,
  formatTraceparent,
} = require('../../shared/otelTrace');

describe('otelTrace (W3C traceparent stub)', () => {
  test('parses inbound traceparent', () => {
    const tp = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
    const ctx = readTraceParent({ headers: { traceparent: tp } });
    expect(ctx.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(ctx.spanId).toBe('00f067aa0ba902b7');
    expect(ctx.header).toBe(tp);
  });

  test('builds traceparent from request id', () => {
    const ctx = traceparentFromRequestId('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    expect(ctx.traceId).toHaveLength(32);
    expect(ctx.spanId).toHaveLength(16);
    expect(ctx.header).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  test('formatTraceparent round-trip', () => {
    const s = formatTraceparent({
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: '00f067aa0ba902b7',
    });
    expect(s).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
  });
});
