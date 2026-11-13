'use strict';

/**
 * X-Request-Id middleware for managers (mirrors conductor correlation).
 * Sets req.id; echoes X-Request-Id on the response.
 *
 * OpenTelemetry: full SDK export is post-GA. When AEREKOS_OTEL_TRACE=1, inbound
 * W3C traceparent is parsed and echoed; otherwise only X-Request-Id is set.
 * See worker/shared/otelTrace.js.
 */

const { randomUUID } = require('crypto');
const { readTraceParent, traceparentFromRequestId } = require('./otelTrace');

function readIncomingId(req) {
  const h = req.headers || {};
  return h['x-request-id'] || null;
}

function requestIdMiddleware(req, res, next) {
  req.id = readIncomingId(req) || randomUUID();
  res.setHeader('X-Request-Id', req.id);
  if (process.env.AEREKOS_OTEL_TRACE === '1') {
    const ctx = readTraceParent(req) || traceparentFromRequestId(req.id);
    req.traceId = ctx.traceId;
    req.spanId = ctx.spanId;
    req.traceparent = ctx.header;
    res.setHeader('traceparent', ctx.header);
  }
  next();
}

module.exports = { requestIdMiddleware, readIncomingId };
