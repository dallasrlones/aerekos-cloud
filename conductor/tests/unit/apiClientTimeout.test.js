const { resolveClientTimeout } = require('../../app/utils/apiTimeout');

describe('resolveClientTimeout', () => {
  const def = 15000;
  const slow = 120000;

  test('bumps intelligence chat even when axios inherited the 15s default', () => {
    expect(resolveClientTimeout(
      '/api/services/ai_manager/api/v1/intelligence/chat',
      def,
      def,
      slow,
    )).toBe(slow);
  });

  test('keeps an explicit short timeout', () => {
    expect(resolveClientTimeout('/api/auth/me', 8000, def, slow)).toBe(8000);
  });

  test('leaves fast manager GETs at the default', () => {
    expect(resolveClientTimeout('/api/services/ai_manager/api/v1/providers', def, def, slow)).toBe(def);
  });
});
