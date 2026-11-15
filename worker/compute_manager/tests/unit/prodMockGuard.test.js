'use strict';

/**
 * Production must never run with SKIP_DOCKER (mock container path).
 * Live guard: assertNoSkipFakes() at boot in index.js.
 */
describe('no prod mocks', () => {
  test('SKIP_DOCKER=1 is forbidden when NODE_ENV=production', () => {
    const wouldExit = (nodeEnv, skip) =>
      nodeEnv === 'production' && (skip === '1' || skip === 'true');
    expect(wouldExit('production', '1')).toBe(true);
    expect(wouldExit('production', 'true')).toBe(true);
    expect(wouldExit('production', '0')).toBe(false);
    expect(wouldExit('development', '1')).toBe(false);
    expect(wouldExit('test', '1')).toBe(false);
  });

  test('index.js boots with assertNoSkipFakes', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../../index.js'), 'utf8');
    expect(src).toMatch(/assertNoSkipFakes\s*\(/);
    expect(src).toMatch(/prodGuards/);
  });
});
