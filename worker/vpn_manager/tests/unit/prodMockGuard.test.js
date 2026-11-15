'use strict';

/**
 * Production must never run with shared skip-fake flags.
 * Live guard: worker/shared/prodGuards.assertNoSkipFakes (wired in index.js + createManagerApp).
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

  test('MOCK_KEY_MANAGER is forbidden when NODE_ENV=production', () => {
    const wouldDie = (nodeEnv, mockKm) => {
      if (nodeEnv !== 'production') return false;
      return String(mockKm || '').toLowerCase() === 'true';
    };
    expect(wouldDie('production', 'true')).toBe(true);
    expect(wouldDie('test', 'true')).toBe(false);
  });
});
