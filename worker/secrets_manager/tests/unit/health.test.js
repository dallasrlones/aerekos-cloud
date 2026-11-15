'use strict';

describe('secrets_manager health unit surface', () => {
  test('package name is secrets_manager', () => {
    const pkg = require('../../package.json');
    expect(pkg.name).toBe('secrets_manager');
  });
});
