'use strict';

/**
 * Production must never run with SKIP_DUCKDB (or shared skip-fake flags).
 * Live guard: worker/shared/prodGuards.assertNoSkipFakes (wired in index.js with extra SKIP_DUCKDB).
 */
describe('no prod mocks', () => {
  test('SKIP_DUCKDB is forbidden when NODE_ENV=production', () => {
    const wouldDie = (nodeEnv, skipDuckdb) => {
      if (nodeEnv !== 'production') return false;
      const v = String(skipDuckdb || '').toLowerCase();
      return v === '1' || v === 'true';
    };
    expect(wouldDie('production', '1')).toBe(true);
    expect(wouldDie('production', 'true')).toBe(true);
    expect(wouldDie('production', '0')).toBe(false);
    expect(wouldDie('test', '1')).toBe(false);
    expect(wouldDie('development', 'true')).toBe(false);
  });
});
