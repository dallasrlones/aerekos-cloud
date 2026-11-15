'use strict';

const fs = require('fs');
const path = require('path');
const { assertNoSkipFakes } = require('../../../shared/prodGuards');

describe('slack_manager health / prod guards', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env.NODE_ENV = prev.NODE_ENV;
    delete process.env.SKIP_SLACK;
    delete process.env.SKIP_OUTBOUND;
    delete process.env.SKIP_DOCKER;
    delete process.env.MOCK_KEY_MANAGER;
  });

  test('assertNoSkipFakes refuses SKIP_SLACK=1 when NODE_ENV=production', () => {
    process.env.NODE_ENV = 'production';
    process.env.SKIP_SLACK = '1';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    assertNoSkipFakes({ extra: ['SKIP_SLACK', 'SKIP_OUTBOUND'] });
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errSpy.mockRestore();
  });

  test('assertNoSkipFakes allows SKIP_SLACK in non-production', () => {
    process.env.NODE_ENV = 'test';
    process.env.SKIP_SLACK = '1';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    assertNoSkipFakes({ extra: ['SKIP_SLACK', 'SKIP_OUTBOUND'] });
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  test('index.js boots with assertNoSkipFakes and SKIP_SLACK/SKIP_OUTBOUND extras', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../index.js'), 'utf8');
    expect(src).toMatch(/assertNoSkipFakes\s*\(/);
    expect(src).toMatch(/SKIP_SLACK/);
    expect(src).toMatch(/SKIP_OUTBOUND/);
  });
});
