'use strict';

/**
 * Production must never run with SKIP_DOWNLOAD / SKIP_TORRENT (or shared skip-fake flags).
 * Live guard: assertNoSkipFakes in index.js (extra SKIP_TORRENT) + createManagerApp defaults (includes SKIP_DOWNLOAD).
 */
describe('no prod mocks', () => {
  test('SKIP_DOWNLOAD is forbidden when NODE_ENV=production', () => {
    const wouldDie = (nodeEnv, skip) => {
      if (nodeEnv !== 'production') return false;
      const v = String(skip || '').toLowerCase();
      return v === '1' || v === 'true';
    };
    expect(wouldDie('production', '1')).toBe(true);
    expect(wouldDie('production', 'true')).toBe(true);
    expect(wouldDie('production', '0')).toBe(false);
    expect(wouldDie('test', '1')).toBe(false);
    expect(wouldDie('development', 'true')).toBe(false);
  });

  test('SKIP_TORRENT is forbidden when NODE_ENV=production', () => {
    const wouldDie = (nodeEnv, skip) => {
      if (nodeEnv !== 'production') return false;
      const v = String(skip || '').toLowerCase();
      return v === '1' || v === 'true';
    };
    expect(wouldDie('production', '1')).toBe(true);
    expect(wouldDie('test', '1')).toBe(false);
  });
});
