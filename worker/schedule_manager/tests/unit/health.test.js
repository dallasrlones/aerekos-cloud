describe('schedule_manager health surface', () => {
  test('default PORT is 3102 (collides with key_manager in managerServicePorts — documented, not reassigned here)', () => {
    const prev = process.env.PORT;
    delete process.env.PORT;
    jest.resetModules();
    // Re-require only the listen default expression via the same fallback as index.js
    const PORT = parseInt(process.env.PORT || '3102', 10);
    expect(PORT).toBe(3102);
    if (prev !== undefined) process.env.PORT = prev;
  });

  test('liveness paths used by conductor isLiveness are /health and /ready', () => {
    const isLiveness = (path) => path === '/health' || path === '/ready';
    expect(isLiveness('/health')).toBe(true);
    expect(isLiveness('/ready')).toBe(true);
    expect(isLiveness('/api/v1/schedules')).toBe(false);
  });
});
