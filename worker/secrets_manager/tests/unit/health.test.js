'use strict';

describe('secrets_manager health unit surface', () => {
  test('package name is secrets_manager', () => {
    const pkg = require('../../package.json');
    expect(pkg.name).toBe('secrets_manager');
  });

  test('registers secrets + encryption capabilities (catalog honesty)', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../api/utils/serviceRegistration.js'),
      'utf8'
    );
    expect(src).toMatch(/['"]secrets['"]/);
    expect(src).toMatch(/['"]encryption['"]/);
    expect(src).not.toMatch(/rotation_hooks/);
  });
});
