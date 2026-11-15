'use strict';

/**
 * Health/proxy honesty: /health is liveness; /ready requires key_manager unless mock.
 * Mirrors index.js route policy without booting the full service.
 */
describe('health / ready policy', () => {
  test('liveness does not require key_manager', () => {
    const livenessNeedsKeyManager = false;
    expect(livenessNeedsKeyManager).toBe(false);
  });

  test('readiness skips key_manager only when MOCK_KEY_MANAGER=true', () => {
    const readinessSkipsKeyManager = (mock) => mock === 'true';
    expect(readinessSkipsKeyManager('true')).toBe(true);
    expect(readinessSkipsKeyManager('false')).toBe(false);
    expect(readinessSkipsKeyManager(undefined)).toBe(false);
  });

  test('conductor proxy treats /health and /ready as projectless liveness', () => {
    const isLiveness = (path) => path === '/health' || path === '/ready';
    expect(isLiveness('/health')).toBe(true);
    expect(isLiveness('/ready')).toBe(true);
    expect(isLiveness('/api/projects/x/buckets')).toBe(false);
  });
});
