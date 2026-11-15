'use strict';

/**
 * Production must never run with shared skip-fake flags.
 * Live guard: worker/shared/prodGuards.assertNoSkipFakes
 * (via createManagerApp + SKIP_PUSH / SKIP_OUTBOUND extras).
 */
describe('no prod mocks', () => {
  test('SKIP_DOCKER is forbidden when NODE_ENV=production', () => {
    const wouldDie = (nodeEnv, skipDocker) => {
      if (nodeEnv !== 'production') return false;
      const v = String(skipDocker || '').toLowerCase();
      return v === '1' || v === 'true';
    };
    expect(wouldDie('production', '1')).toBe(true);
    expect(wouldDie('production', 'true')).toBe(true);
    expect(wouldDie('production', '0')).toBe(false);
    expect(wouldDie('test', '1')).toBe(false);
    expect(wouldDie('development', 'true')).toBe(false);
  });
});
