'use strict';

const fs = require('fs');
const path = require('path');
const { assertNoSkipFakes } = require('../../../shared/prodGuards');

describe('push_manager health / prod guards', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env.NODE_ENV = prev.NODE_ENV;
    delete process.env.SKIP_DOCKER;
    delete process.env.SKIP_INVOKE;
    delete process.env.SKIP_OUTBOUND;
    delete process.env.SKIP_PUSH;
    delete process.env.MOCK_KEY_MANAGER;
  });

  test('assertNoSkipFakes refuses SKIP_DOCKER=1 when NODE_ENV=production', () => {
    process.env.NODE_ENV = 'production';
    process.env.SKIP_DOCKER = '1';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    assertNoSkipFakes();
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errSpy.mockRestore();
  });

  test('assertNoSkipFakes refuses SKIP_PUSH=1 when NODE_ENV=production (extra)', () => {
    process.env.NODE_ENV = 'production';
    process.env.SKIP_PUSH = '1';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    assertNoSkipFakes({ extra: ['SKIP_PUSH', 'SKIP_OUTBOUND'] });
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errSpy.mockRestore();
  });

  test('assertNoSkipFakes refuses SKIP_OUTBOUND=1 when NODE_ENV=production (extra)', () => {
    process.env.NODE_ENV = 'production';
    process.env.SKIP_OUTBOUND = '1';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    assertNoSkipFakes({ extra: ['SKIP_PUSH', 'SKIP_OUTBOUND'] });
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errSpy.mockRestore();
  });

  test('assertNoSkipFakes allows skip flags in non-production', () => {
    process.env.NODE_ENV = 'test';
    process.env.SKIP_DOCKER = '1';
    process.env.SKIP_PUSH = '1';
    process.env.SKIP_OUTBOUND = '1';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    assertNoSkipFakes({ extra: ['SKIP_PUSH', 'SKIP_OUTBOUND'] });
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  test('index.js boots via createManagerApp (assertNoSkipFakes + SKIP_PUSH)', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../index.js'), 'utf8');
    expect(src).toMatch(/createManagerApp\s*\(/);
    expect(src).toMatch(/SKIP_PUSH/);
    expect(src).toMatch(/SKIP_OUTBOUND/);
  });
});
