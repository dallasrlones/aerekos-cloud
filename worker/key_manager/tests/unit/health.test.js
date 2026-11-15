'use strict';

const fs = require('fs');
const path = require('path');

describe('key_manager health honesty', () => {
  const indexSrc = fs.readFileSync(path.join(__dirname, '../../index.js'), 'utf8');

  test('package name is key_manager', () => {
    const pkg = require('../../package.json');
    expect(pkg.name).toBe('key_manager');
  });

  test('exposes /health and /ready liveness routes', () => {
    expect(indexSrc).toMatch(/app\.get\(['"]\/health['"]/);
    expect(indexSrc).toMatch(/app\.get\(['"]\/ready['"]/);
  });

  test('default PORT aligns with conductor map (3102)', () => {
    expect(indexSrc).toMatch(/process\.env\.PORT\s*\|\|\s*3102/);
    expect(process.env.PORT).toBe('3102');
  });

  test('ready checks MASTER_KEY and database', () => {
    expect(indexSrc).toMatch(/Master key not loaded/);
    expect(indexSrc).toMatch(/db\.healthCheck/);
  });
});
