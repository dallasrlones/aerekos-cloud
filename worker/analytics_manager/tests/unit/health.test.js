'use strict';

const fs = require('fs');
const path = require('path');
const { assertNoSkipFakes } = require('../../../shared/prodGuards');

describe('analytics_manager health / prod guards', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env.NODE_ENV = prev.NODE_ENV;
    delete process.env.SKIP_DOCKER;
    delete process.env.SKIP_DUCKDB;
    delete process.env.MOCK_KEY_MANAGER;
  });

  test('default listen port is 3117', () => {
    const PORT = parseInt(process.env.PORT || '3117', 10);
    expect(PORT).toBe(3117);
  });

  test('assertNoSkipFakes refuses SKIP_DOCKER=1 when NODE_ENV=production', () => {
    process.env.NODE_ENV = 'production';
    process.env.SKIP_DOCKER = '1';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    assertNoSkipFakes({ extra: ['SKIP_DUCKDB'] });
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errSpy.mockRestore();
  });

  test('assertNoSkipFakes refuses SKIP_DUCKDB=1 when NODE_ENV=production', () => {
    process.env.NODE_ENV = 'production';
    process.env.SKIP_DUCKDB = '1';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    assertNoSkipFakes({ extra: ['SKIP_DUCKDB'] });
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errSpy.mockRestore();
  });

  test('assertNoSkipFakes allows skip flags in non-production', () => {
    process.env.NODE_ENV = 'test';
    process.env.SKIP_DOCKER = '1';
    process.env.SKIP_DUCKDB = '1';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    assertNoSkipFakes({ extra: ['SKIP_DUCKDB'] });
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  test('index.js boots with assertNoSkipFakes', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../index.js'), 'utf8');
    expect(src).toMatch(/assertNoSkipFakes\s*\(/);
    expect(src).toMatch(/SKIP_DUCKDB/);
  });
});
