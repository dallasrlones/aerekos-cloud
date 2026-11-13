'use strict';

/**
 * Soft-delete helpers for managers using `deleted_at` (ISO-8601 TEXT).
 * For full ORM support use aerekos-record `softDelete: true` instead.
 */

/**
 * @returns {{ deleted_at: string }}
 */
function softDeleteTimestamps(at = new Date()) {
  const when = at instanceof Date ? at : new Date(at);
  return { deleted_at: when.toISOString() };
}

/**
 * Returns true if the row looks soft-deleted.
 * @param {{ deleted_at?: string|null }} row
 */
function isSoftDeleted(row) {
  if (!row || row.deleted_at == null) return false;
  const s = String(row.deleted_at).trim();
  return s.length > 0;
}

/**
 * Filter in-memory rows (lists before pagination).
 * @param {Array<Record<string, unknown>>} rows
 * @param {{ withDeleted?: boolean }} [opts]
 */
function filterActiveRows(rows, opts = {}) {
  if (opts.withDeleted) return rows;
  return (rows || []).filter((r) => !isSoftDeleted(r));
}

/**
 * Merge `deleted_at IS NULL` into a simple where object for hand-rolled SQL builders.
 * @param {Record<string, unknown>} [where]
 * @param {{ withDeleted?: boolean }} [opts]
 */
function mergeActiveWhere(where = {}, opts = {}) {
  if (opts.withDeleted) return { ...where };
  return { ...where, deleted_at: null };
}

/**
 * SQLite fragment + param for optional table alias.
 * @param {{ withDeleted?: boolean, alias?: string }} [opts]
 * @returns {{ clause: string, params: unknown[] }}
 */
function activeOnlyClause(opts = {}) {
  if (opts.withDeleted) return { clause: '', params: [] };
  const col = opts.alias ? `${opts.alias}.deleted_at` : 'deleted_at';
  return { clause: `${col} IS NULL`, params: [] };
}

module.exports = {
  softDeleteTimestamps,
  isSoftDeleted,
  filterActiveRows,
  mergeActiveWhere,
  activeOnlyClause,
};
