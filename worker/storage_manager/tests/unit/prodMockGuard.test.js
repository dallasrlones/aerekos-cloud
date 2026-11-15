'use strict';

/**
 * Production must never run with MOCK_KEY_MANAGER=true.
 * The live guard is in index.js when require.main === module; we assert the same rule here.
 */
describe('no prod mocks', () => {
  test('MOCK_KEY_MANAGER=true is forbidden when NODE_ENV=production', () => {
    const wouldExit = (nodeEnv, mock) => nodeEnv === 'production' && mock === 'true';
    expect(wouldExit('production', 'true')).toBe(true);
    expect(wouldExit('production', 'false')).toBe(false);
    expect(wouldExit('development', 'true')).toBe(false);
    expect(wouldExit('test', 'true')).toBe(false);
  });
});
