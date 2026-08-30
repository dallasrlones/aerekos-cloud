'use strict';

const { PLATFORM_DEVICE_SERVICES, isPlatformDeviceService } = require('../../api/config/platformDeviceServices');

describe('platformDeviceServices', () => {
  test('covers identity, observe, ship, edge, device', () => {
    for (const name of ['key_manager', 'logs_manager', 'git_manager', 'tunnel_manager', 'host_manager']) {
      expect(PLATFORM_DEVICE_SERVICES).toContain(name);
    }
    expect(PLATFORM_DEVICE_SERVICES).not.toContain('billing_manager');
    expect(PLATFORM_DEVICE_SERVICES).not.toContain('ai_manager');
  });

  test('isPlatformDeviceService', () => {
    expect(isPlatformDeviceService('logs_manager')).toBe(true);
    expect(isPlatformDeviceService('compute_manager')).toBe(true);
    expect(isPlatformDeviceService('billing_manager')).toBe(false);
  });
});
