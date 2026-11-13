'use strict';

/**
 * Cursor-based list pagination (enterprise E2).
 * Query: ?limit=50&cursor=  →  response: { items, next_cursor? }
 *
 * Cursors are opaque base64url JSON payloads; do not parse client-side.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function clampLimit(raw) {
  const n = parseInt(String(raw ?? DEFAULT_LIMIT), 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function encodeCursor(payload) {
  if (payload == null) return null;
  const json = JSON.stringify(payload);
  return Buffer.from(json, 'utf8').toString('base64url');
}

function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== 'string') return null;
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const data = JSON.parse(json);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

/** @param {{ limit?: string|number, cursor?: string }} query */
function parseListQuery(query = {}) {
  const limit = clampLimit(query.limit);
  const cursor = query.cursor ? String(query.cursor) : null;
  return { limit, cursor };
}

/**
 * Keyset-style page over an in-memory array (items should be stably ordered).
 * Cursor payload: { after: <last id seen> }.
 */
function paginateArray(
  rows,
  { limit, cursor, idOf = (r) => r.id } = {}
) {
  const lim = clampLimit(limit);
  const list = Array.isArray(rows) ? rows : [];
  let start = 0;
  const decoded = cursor ? decodeCursor(cursor) : null;
  if (decoded?.after != null) {
    const after = String(decoded.after);
    const idx = list.findIndex((r) => String(idOf(r)) === after);
    start = idx >= 0 ? idx + 1 : 0;
  }
  const items = list.slice(start, start + lim);
  const hasMore = start + items.length < list.length;
  const next_cursor =
    hasMore && items.length
      ? encodeCursor({ after: idOf(items[items.length - 1]) })
      : null;
  return { items, next_cursor };
}

/** Invalid cursor for handlers that want a 400. */
function invalidCursorError() {
  const e = new Error('invalid cursor');
  e.status = 400;
  e.code = 'InvalidCursor';
  return e;
}

/** Guard: throw if cursor present but undecodable (when strict). */
function assertValidCursor(cursor, { strict = false } = {}) {
  if (!cursor) return null;
  const decoded = decodeCursor(cursor);
  if (strict && !decoded) throw invalidCursorError();
  return decoded;
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  clampLimit,
  encodeCursor,
  decodeCursor,
  parseListQuery,
  paginateArray,
  invalidCursorError,
  assertValidCursor,
};
