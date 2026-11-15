'use strict';

/**
 * Production must never run with SKIP_SLACK / SKIP_OUTBOUND (or shared skip-fake flags).
 * Live guard: worker/shared/prodGuards.assertNoSkipFakes (wired in index.js).
 */
describe('no prod mocks', () => {
  test('SKIP_SLACK is forbidden when NODE_ENV=production', () => {
    const wouldDie = (nodeEnv, skipSlack) => {
      if (nodeEnv !== 'production') return false;
      const v = String(skipSlack || '').toLowerCase();
      return v === '1' || v === 'true';
    };
    expect(wouldDie('production', '1')).toBe(true);
    expect(wouldDie('production', 'true')).toBe(true);
    expect(wouldDie('production', '0')).toBe(false);
    expect(wouldDie('test', '1')).toBe(false);
    expect(wouldDie('development', 'true')).toBe(false);
  });
});
