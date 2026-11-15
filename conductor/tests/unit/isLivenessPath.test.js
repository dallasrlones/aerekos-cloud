'use strict';

const { isLivenessPath } = require('../../api/utils/isLivenessPath');

describe('isLivenessPath', () => {
  test('treats /health and /ready as liveness', () => {
    expect(isLivenessPath('/health')).toBe(true);
    expect(isLivenessPath('/ready')).toBe(true);
  });

  test('strips query string', () => {
    expect(isLivenessPath('/health?project_id=x')).toBe(true);
    expect(isLivenessPath('/ready?x=1')).toBe(true);
  });

  test('rejects non-liveness and nested paths', () => {
    expect(isLivenessPath('/api/v1/info')).toBe(false);
    expect(isLivenessPath('/healthz')).toBe(false);
    expect(isLivenessPath('/api/health')).toBe(false);
    expect(isLivenessPath('/ready/extra')).toBe(false);
  });

  test('rejects empty / non-string', () => {
    expect(isLivenessPath('')).toBe(false);
    expect(isLivenessPath(null)).toBe(false);
    expect(isLivenessPath(undefined)).toBe(false);
  });
});
