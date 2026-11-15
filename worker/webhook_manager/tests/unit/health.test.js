'use strict';

const fs = require('fs');
const path = require('path');
const { assertNoSkipFakes } = require('../../../shared/prodGuards');

describe('webhook_manager health / prod guards', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env.NODE_ENV = prev.NODE_ENV;
    delete process.env.SKIP_OUTBOUND;
    delete process.env.SKIP_DOCKER;
    delete process.env.MOCK_KEY_MANAGER;
  });

  test('assertNoSkipFakes refuses SKIP_OUTBOUND=1 when NODE_ENV=production', () => {
    process.env.NODE_ENV = 'production';
    process.env.SKIP_OUTBOUND = '1';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    assertNoSkipFakes({ extra: ['SKIP_OUTBOUND'] });
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errSpy.mockRestore();
  });

  test('assertNoSkipFakes allows SKIP_OUTBOUND in non-production', () => {
    process.env.NODE_ENV = 'test';
    process.env.SKIP_OUTBOUND = '1';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    assertNoSkipFakes({ extra: ['SKIP_OUTBOUND'] });
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  test('index.js boots with createManagerApp and SKIP_OUTBOUND extra', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../index.js'), 'utf8');
    expect(src).toMatch(/createManagerApp\s*\(/);
    expect(src).toMatch(/assertNoSkipFakes\s*\(/);
    expect(src).toMatch(/SKIP_OUTBOUND/);
  });
});
