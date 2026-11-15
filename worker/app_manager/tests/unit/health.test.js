'use strict';

describe('app_manager port default', () => {
  test('default listen port is 3125', () => {
    const PORT = parseInt(process.env.PORT || '3125', 10);
    expect(PORT).toBe(3125);
  });
});
