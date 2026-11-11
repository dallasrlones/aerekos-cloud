'use strict';

/** Pure helpers for Adonis dirty-file / branch switch guards. */

function isDirty(original, current) {
  return String(original ?? '') !== String(current ?? '');
}

function canSwitchRef({ dirty, confirm }) {
  if (!dirty) return true;
  if (typeof confirm === 'function') return Boolean(confirm());
  return false;
}

function defaultCommitMessage(path) {
  const p = String(path || '').trim() || 'file';
  return `Update ${p}`;
}

module.exports = { isDirty, canSwitchRef, defaultCommitMessage };
