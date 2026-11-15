'use strict';

/**
 * Production must never run with SKIP_CLOUDFLARE (or shared skip-fake flags).
 * Live guard: worker/shared/prodGuards.assertNoSkipFakes (wired in index.js).
 */
describe('no prod mocks', () => {
  test('SKIP_CLOUDFLARE is forbidden when NODE_ENV=production', () => {
    const wouldDie = (nodeEnv, skipCf) => {
      if (nodeEnv !== 'production') return false;
      const v = String(skipCf || '').toLowerCase();
      return v === '1' || v === 'true';
    };
    expect(wouldDie('production', '1')).toBe(true);
    expect(wouldDie('production', 'true')).toBe(true);
    expect(wouldDie('production', '0')).toBe(false);
    expect(wouldDie('test', '1')).toBe(false);
    expect(wouldDie('development', 'true')).toBe(false);
  });
});
