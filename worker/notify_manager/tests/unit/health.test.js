'use strict';

const fs = require('fs');
const path = require('path');
const { assertNoSkipFakes } = require('../../../shared/prodGuards');

describe('notify_manager health / prod guards', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env.NODE_ENV = prev.NODE_ENV;
    delete process.env.NOTIFY_USE_MOCK;
    delete process.env.SKIP_OUTBOUND;
    delete process.env.SKIP_DOCKER;
    delete process.env.MOCK_KEY_MANAGER;
  });

  test('assertNoSkipFakes refuses NOTIFY_USE_MOCK=1 when NODE_ENV=production', () => {
    process.env.NODE_ENV = 'production';
    process.env.NOTIFY_USE_MOCK = '1';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    assertNoSkipFakes({ extra: ['NOTIFY_USE_MOCK', 'SKIP_OUTBOUND'] });
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errSpy.mockRestore();
  });

  test('assertNoSkipFakes refuses SKIP_OUTBOUND=1 when NODE_ENV=production', () => {
    process.env.NODE_ENV = 'production';
    process.env.SKIP_OUTBOUND = '1';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    assertNoSkipFakes({ extra: ['NOTIFY_USE_MOCK', 'SKIP_OUTBOUND'] });
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errSpy.mockRestore();
  });

  test('assertNoSkipFakes allows mock/skip flags in non-production', () => {
    process.env.NODE_ENV = 'test';
    process.env.NOTIFY_USE_MOCK = '1';
    process.env.SKIP_OUTBOUND = '1';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    assertNoSkipFakes({ extra: ['NOTIFY_USE_MOCK', 'SKIP_OUTBOUND'] });
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  test('index.js boots via createManagerApp (assertNoSkipFakes extras)', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../index.js'), 'utf8');
    expect(src).toMatch(/createManagerApp\s*\(/);
    expect(src).toMatch(/assertNoSkipFakes\s*\(/);
    expect(src).toMatch(/NOTIFY_USE_MOCK/);
    expect(src).toMatch(/SKIP_OUTBOUND/);
  });
});
