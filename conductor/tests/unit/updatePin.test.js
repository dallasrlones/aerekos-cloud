'use strict';

const UpdateService = require('../../api/services/UpdateService');

describe('UpdateService pin/unpin', () => {
  test('pin then unpin', () => {
    const host = `pin-${Date.now()}`;
    expect(UpdateService.pin(host, '1.2.3')).toEqual({ pinned: true, hostname: host, version: '1.2.3' });
    expect(UpdateService.pinnedVersion(host)).toBe('1.2.3');
    expect(UpdateService.unpin(host)).toEqual({ pinned: false, hostname: host });
    expect(UpdateService.pinnedVersion(host)).toBe(null);
  });
});
