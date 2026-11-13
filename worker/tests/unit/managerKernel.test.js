'use strict';

const {
  paginateArray,
  encodeCursor,
  decodeCursor,
  formatErrorBody,
  Provider,
  LocalProvider,
} = require('../../shared/managerKernel');

describe('managerKernel', () => {
  test('paginateArray returns next_cursor when more rows exist', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const first = paginateArray(rows, { limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.next_cursor).toBeTruthy();
    const second = paginateArray(rows, { limit: 2, cursor: first.next_cursor });
    expect(second.items).toEqual([{ id: 'c' }]);
    expect(second.next_cursor).toBeNull();
  });

  test('cursor round-trip', () => {
    const c = encodeCursor({ after: 'item-9' });
    expect(decodeCursor(c)).toEqual({ after: 'item-9' });
  });

  test('formatErrorBody uses request_id', () => {
    const body = formatErrorBody({
      code: 'NotFound',
      message: 'missing',
      request_id: 'req-123',
    });
    expect(body).toEqual({
      error: { code: 'NotFound', message: 'missing', request_id: 'req-123' },
    });
  });

  test('Provider.create defaults to local', () => {
    const p = Provider.create();
    expect(p).toBeInstanceOf(LocalProvider);
    expect(p.describe().kind).toBe('local');
  });

  test('cloud provider is not implemented', () => {
    expect(() => Provider.create('aws')).toThrow(/not implemented/);
  });
});
