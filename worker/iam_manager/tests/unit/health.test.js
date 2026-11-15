'use strict';

/**
 * Smoke unit: package scripts resolve. Domain coverage is in IamService.test.js.
 */
describe('iam_manager unit harness', () => {
  test('jest + service package load', () => {
    const pkg = require('../../package.json');
    expect(pkg.name).toBe('iam_manager');
  });
});
