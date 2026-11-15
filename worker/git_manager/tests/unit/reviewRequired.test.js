'use strict';

const { reviewRequired, reviewMergeGate } = require('../../api/utils/reviewRequired');

describe('reviewRequired', () => {
  test('reads require_approval from repo row', () => {
    expect(reviewRequired({ require_approval: 1 })).toBe(true);
    expect(reviewRequired({ require_approval: 0 })).toBe(false);
    expect(reviewRequired({})).toBe(false);
  });

  test('accepts boolean / number / string flags', () => {
    expect(reviewRequired(true)).toBe(true);
    expect(reviewRequired(false)).toBe(false);
    expect(reviewRequired(1)).toBe(true);
    expect(reviewRequired('true')).toBe(true);
    expect(reviewRequired('0')).toBe(false);
  });
});

describe('reviewMergeGate', () => {
  test('blocks when changes_requested', () => {
    expect(reviewMergeGate({
      requireApproval: false,
      reviews: [{ state: 'approved' }, { state: 'changes_requested' }],
    })).toEqual({ ok: false, reason: 'changes_requested' });
  });

  test('blocks when approval required and none approved', () => {
    expect(reviewMergeGate({
      requireApproval: true,
      reviews: [{ state: 'commented' }],
    })).toEqual({ ok: false, reason: 'approval_required' });
  });

  test('allows merge when approved under require_approval', () => {
    expect(reviewMergeGate({
      requireApproval: { require_approval: 1 },
      reviews: [{ state: 'approved' }],
    })).toEqual({ ok: true, reason: null });
  });

  test('allows merge when review not required', () => {
    expect(reviewMergeGate({ requireApproval: false, reviews: [] }))
      .toEqual({ ok: true, reason: null });
  });
});
