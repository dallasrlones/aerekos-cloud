'use strict';

const { buildEndpointArn } = require('./EndpointArn');

function safeArn(projectId, capability, name) {
  try {
    return buildEndpointArn(projectId, capability, name);
  } catch {
    return `arn:aerekos:${projectId}:ai:${capability === 'connector' ? 'connector:account' : `${capability}:endpoint`}/${name}`;
  }
}

function json(v, fallback) {
  if (v == null || v === '') return fallback;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return fallback; }
}

function fail(status, message, code) {
  const e = new Error(message);
  e.status = status;
  if (code) e.code = code;
  return e;
}

function flag(v, fallback = 'true') {
  if (v === undefined || v === null || v === '') return fallback;
  return (v === true || v === 'true' || v === '1' || v === 1) ? 'true' : 'false';
}

function parseJsonField(row, key, fallback) {
  if (!row) return fallback;
  return json(row[key], fallback);
}

function scrubSecrets(s) {
  return String(s == null ? '' : s)
    .replace(/sk-[A-Za-z0-9]{10,}/g, '[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/(api[_-]?key|token|secret|password)[=:]\s*\S+/gi, '$1=[redacted]');
}

module.exports = { safeArn, json, fail, flag, parseJsonField, scrubSecrets };
