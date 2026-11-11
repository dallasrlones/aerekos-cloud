'use strict';

const {
  resolveLaneIntelligence, defaultLaneIntelligenceNames, KIND_LANES,
} = require('../../api/services/laneIntelligence');

describe('laneIntelligence', () => {
  const agent = {
    intelligence: 'icarus-brain',
    options: {
      lane_intelligence: {
        user: 'icarus-user',
        manager: 'icarus-manager',
        review: 'icarus-manager',
        worker: 'icarus-worker',
        coding: 'icarus-worker',
      },
    },
  };

  test('maps user/manager/execute/review lanes', () => {
    expect(resolveLaneIntelligence(agent, 'user')).toMatchObject({
      intelligence: 'icarus-user', kind: 'user',
    });
    expect(resolveLaneIntelligence(agent, 'manager')).toMatchObject({
      intelligence: 'icarus-manager', kind: 'manager',
    });
    expect(resolveLaneIntelligence(agent, 'execute')).toMatchObject({
      intelligence: 'icarus-worker', kind: 'coding',
    });
    expect(resolveLaneIntelligence(agent, 'review')).toMatchObject({
      intelligence: 'icarus-manager', kind: 'review',
    });
  });

  test('review never falls back to coding worker intelligence', () => {
    const thin = {
      intelligence: 'icarus-worker',
      options: { lane_intelligence: { worker: 'icarus-worker', coding: 'icarus-worker' } },
    };
    const r = resolveLaneIntelligence(thin, 'review');
    expect(r.kind).toBe('review');
    expect(r.intelligence).not.toBe('icarus-worker');
  });

  test('default names include review → manager', () => {
    const n = defaultLaneIntelligenceNames('icarus');
    expect(n.user).toBe('icarus-user');
    expect(n.manager).toBe('icarus-manager');
    expect(n.review).toBe('icarus-manager');
    expect(n.worker).toBe('icarus-worker');
  });

  test('KIND_LANES keeps review with manager tier', () => {
    expect(KIND_LANES.manager).toContain('review');
    expect(KIND_LANES.review).toContain('review');
  });
});
