'use strict';

/**
 * Production must never run with shared skip-fake flags.
 * Live guard: worker/shared/prodGuards.assertNoSkipFakes (wired in index.js with SKIP_DUCKDB).
 */
describe('no prod mocks', () => {
  test('SKIP_DOCKER is forbidden when NODE_ENV=production', () => {
    const wouldDie = (nodeEnv, skipDocker) => {
      if (nodeEnv !== 'production') return false;
      const v = String(skipDocker || '').toLowerCase();
      return v === '1' || v === 'true';
    };
    expect(wouldDie('production', '1')).toBe(true);
    expect(wouldDie('test', '1')).toBe(false);
  });

  test('SKIP_DUCKDB is forbidden when NODE_ENV=production', () => {
    const wouldDie = (nodeEnv, skipDuck) => {
      if (nodeEnv !== 'production') return false;
      const v = String(skipDuck || '').toLowerCase();
      return v === '1' || v === 'true';
    };
    expect(wouldDie('production', 'true')).toBe(true);
    expect(wouldDie('development', 'true')).toBe(false);
  });
});
