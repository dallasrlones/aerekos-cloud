'use strict';

const { assertNoSkipFakes } = require('../../../shared/prodGuards');

describe('compute_manager health / prod guards', () => {
  const prev = {
    NODE_ENV: process.env.NODE_ENV,
    SKIP_DOCKER: process.env.SKIP_DOCKER,
  };

  afterEach(() => {
    process.env.NODE_ENV = prev.NODE_ENV;
    if (prev.SKIP_DOCKER === undefined) delete process.env.SKIP_DOCKER;
    else process.env.SKIP_DOCKER = prev.SKIP_DOCKER;
    jest.restoreAllMocks();
  });

  test('assertNoSkipFakes refuses SKIP_DOCKER=1 when NODE_ENV=production', () => {
    process.env.NODE_ENV = 'production';
    process.env.SKIP_DOCKER = '1';
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    assertNoSkipFakes();
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls.some((c) => String(c[0]).includes('SKIP_DOCKER'))).toBe(true);
  });

  test('assertNoSkipFakes allows SKIP_DOCKER in non-production', () => {
    process.env.NODE_ENV = 'test';
    process.env.SKIP_DOCKER = '1';
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    assertNoSkipFakes();
    expect(exit).not.toHaveBeenCalled();
  });
});
