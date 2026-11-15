'use strict';

/**
 * Repo-level "review required" flag (`repositories.require_approval`).
 * Used by merge gates and (future) console UX so API + UI share one rule.
 */

function reviewRequired(repoOrFlag) {
  if (typeof repoOrFlag === 'boolean') return repoOrFlag;
  if (typeof repoOrFlag === 'number') return repoOrFlag === 1;
  if (typeof repoOrFlag === 'string') {
    const s = repoOrFlag.trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'yes';
  }
  return Number(repoOrFlag?.require_approval || 0) === 1;
}

/**
 * Merge-time review gate (does not consider check runs).
 * @returns {{ ok: boolean, reason: string|null }}
 */
function reviewMergeGate({ requireApproval, reviews } = {}) {
  const list = Array.isArray(reviews) ? reviews : [];
  if (list.some((rv) => String(rv.state || '').toLowerCase() === 'changes_requested')) {
    return { ok: false, reason: 'changes_requested' };
  }
  const needed = typeof requireApproval === 'boolean'
    ? requireApproval
    : reviewRequired(requireApproval);
  if (needed && !list.some((rv) => String(rv.state || '').toLowerCase() === 'approved')) {
    return { ok: false, reason: 'approval_required' };
  }
  return { ok: true, reason: null };
}

module.exports = { reviewRequired, reviewMergeGate };
