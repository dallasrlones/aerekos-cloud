'use strict';

const scope = require('../../shared/scope');

describe('scope', () => {
  test('hasScope exact and wildcard', () => {
    expect(scope.hasScope('ai:InvokeLlm ai:InvokeTts', 'ai:InvokeLlm')).toBe(true);
    expect(scope.hasScope('ai:*', 'ai:InvokeLlm')).toBe(true);
    expect(scope.hasScope('*', 'storage:GetObject')).toBe(true);
    expect(scope.hasScope('ai:InvokeLlm', 'storage:GetObject')).toBe(false);
  });

  test('normalizeScopes from array or string', () => {
    expect(scope.normalizeScopes('a b c')).toEqual(['a', 'b', 'c']);
    expect(scope.normalizeScopes(['x', 'y'])).toEqual(['x', 'y']);
  });

  test('hasAllScopes and hasAnyScope', () => {
    const g = 'ai:InvokeLlm storage:GetObject';
    expect(scope.hasAllScopes(g, ['ai:InvokeLlm', 'storage:GetObject'])).toBe(true);
    expect(scope.hasAllScopes(g, ['ai:InvokeLlm', 'db:Connect'])).toBe(false);
    expect(scope.hasAnyScope(g, ['db:Connect', 'storage:GetObject'])).toBe(true);
  });
});
