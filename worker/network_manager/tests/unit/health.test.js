'use strict';

const { ProjectNetworkService } = require('../../api/services/ProjectNetworkService');

describe('network_manager ProjectNetworkService', () => {
  const svc = new ProjectNetworkService({ client: {} });

  test('computeDockerName is stable and prefixed', () => {
    const a = svc.computeDockerName('proj-a', 'front');
    const b = svc.computeDockerName('proj-a', 'front');
    const c = svc.computeDockerName('proj-b', 'front');
    expect(a).toBe(b);
    expect(a).toMatch(/^aerekosn_[a-f0-9]{20}$/);
    expect(a).not.toBe(c);
  });

  test('validateLogicalName accepts and rejects', () => {
    expect(svc.validateLogicalName('front_net')).toBe('front_net');
    expect(() => svc.validateLogicalName('1bad')).toThrow(/name/);
    expect(() => svc.validateLogicalName('')).toThrow(/name/);
  });

  test('assertDriver allows bridge only in MVP', () => {
    expect(svc.assertDriver('bridge')).toBe('bridge');
    expect(svc.assertDriver(undefined)).toBe('bridge');
    try {
      svc.assertDriver('overlay');
      throw new Error('expected throw');
    } catch (e) {
      expect(e.status).toBe(501);
    }
    try {
      svc.assertDriver('macvlan');
      throw new Error('expected throw');
    } catch (e) {
      expect(e.status).toBe(400);
    }
  });
});
