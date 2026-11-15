'use strict';

const { assertNoSkipFakes } = require('../../../shared/prodGuards');

describe('api_manager prod guards', () => {
  const prev = {
    NODE_ENV: process.env.NODE_ENV,
    SKIP_INVOKE: process.env.SKIP_INVOKE,
    SKIP_DB_PROVISION: process.env.SKIP_DB_PROVISION,
  };

  afterEach(() => {
    process.env.NODE_ENV = prev.NODE_ENV;
    if (prev.SKIP_INVOKE === undefined) delete process.env.SKIP_INVOKE;
    else process.env.SKIP_INVOKE = prev.SKIP_INVOKE;
    if (prev.SKIP_DB_PROVISION === undefined) delete process.env.SKIP_DB_PROVISION;
    else process.env.SKIP_DB_PROVISION = prev.SKIP_DB_PROVISION;
    jest.restoreAllMocks();
  });

  test('assertNoSkipFakes refuses SKIP_INVOKE=1 when NODE_ENV=production', () => {
    process.env.NODE_ENV = 'production';
    process.env.SKIP_INVOKE = '1';
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    assertNoSkipFakes({ extra: ['SKIP_DB_PROVISION', 'SKIP_WAF'] });
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls.some((c) => String(c[0]).includes('SKIP_INVOKE'))).toBe(true);
  });

  test('assertNoSkipFakes refuses SKIP_DB_PROVISION in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SKIP_INVOKE;
    process.env.SKIP_DB_PROVISION = '1';
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    assertNoSkipFakes({ extra: ['SKIP_DB_PROVISION', 'SKIP_WAF'] });
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls.some((c) => String(c[0]).includes('SKIP_DB_PROVISION'))).toBe(true);
  });

  test('assertNoSkipFakes allows skip flags in non-production', () => {
    process.env.NODE_ENV = 'test';
    process.env.SKIP_INVOKE = '1';
    process.env.SKIP_DB_PROVISION = '1';
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    assertNoSkipFakes({ extra: ['SKIP_DB_PROVISION', 'SKIP_WAF'] });
    expect(exit).not.toHaveBeenCalled();
  });
});
