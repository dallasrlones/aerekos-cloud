'use strict';

/**
 * W3C traceparent propagation (no OpenTelemetry SDK yet).
 * Enable with AEREKOS_OTEL_TRACE=1 on managers using requestIdMiddleware.
 *
 * Format: 00-{trace-id}-{parent-id}-{flags}
 * @see https://www.w3.org/TR/trace-context/
 */

const TRACEPARENT_RE = /^[\da-f]{2}-([\da-f]{32})-([\da-f]{16})-([\da-f]{2})$/i;

function readTraceParent(req) {
  const h = req.headers || {};
  const raw = h.traceparent || h.Traceparent;
  if (!raw || typeof raw !== 'string') return null;
  const m = raw.trim().match(TRACEPARENT_RE);
  if (!m) return null;
  return {
    version: m[0].slice(0, 2),
    traceId: m[1].toLowerCase(),
    spanId: m[2].toLowerCase(),
    flags: m[3].toLowerCase(),
    header: raw.trim(),
  };
}

/** Deterministic stub trace id from request id when inbound traceparent is absent. */
function traceparentFromRequestId(requestId) {
  const hex = String(requestId || '').replace(/-/g, '').toLowerCase();
  const traceId = `${hex}${'0'.repeat(32)}`.slice(0, 32);
  const spanId = traceId.slice(0, 16);
  const header = `00-${traceId}-${spanId}-01`;
  return { traceId, spanId, header, flags: '01', version: '00' };
}

function formatTraceparent({ traceId, spanId, flags = '01', version = '00' }) {
  return `${version}-${traceId}-${spanId}-${flags}`;
}

/**
 * Standalone middleware (optional). Prefer requestIdMiddleware when both are needed.
 */
function otelTraceMiddleware(req, res, next) {
  const incoming = readTraceParent(req);
  const ctx = incoming || traceparentFromRequestId(req.id);
  req.traceId = ctx.traceId;
  req.spanId = ctx.spanId;
  req.traceparent = ctx.header || formatTraceparent(ctx);
  res.setHeader('traceparent', req.traceparent);
  next();
}

module.exports = {
  readTraceParent,
  traceparentFromRequestId,
  formatTraceparent,
  otelTraceMiddleware,
};
