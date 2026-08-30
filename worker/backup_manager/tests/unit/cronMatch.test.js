'use strict';

const { cronMatch } = require('../../api/services/BackupScheduler');

describe('cronMatch', () => {
  test('matches hour and minute', () => {
    const d = new Date(Date.UTC(2026, 0, 1, 2, 0, 0));
    expect(cronMatch('0 2 * * *', d)).toBe(true);
    expect(cronMatch('0 3 * * *', d)).toBe(false);
  });
});
