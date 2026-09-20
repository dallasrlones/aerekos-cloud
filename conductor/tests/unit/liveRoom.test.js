'use strict';

const { isLiveRoom, isLiveEvent, canJoinLiveRoom } = require('../../api/services/LiveRoom');

describe('LiveRoom', () => {
  test('allows ai:live and compute log rooms', () => {
    expect(isLiveRoom('ai:live')).toBe(true);
    expect(isLiveRoom('ai:live:aec3af8b-5250-4fd4-aa41-ca27654de029')).toBe(true);
    expect(isLiveRoom('logs:compute.abc-123')).toBe(true);
    expect(isLiveRoom('logs:test.unit')).toBe(true);
  });

  test('rejects open rooms', () => {
    expect(isLiveRoom('frontend')).toBe(false);
    expect(isLiveRoom('logs:../../etc')).toBe(false);
    expect(isLiveRoom('worker:x')).toBe(false);
  });

  test('allowlists events', () => {
    expect(isLiveEvent('ai:pull')).toBe(true);
    expect(isLiveEvent('ai:bench')).toBe(true);
    expect(isLiveEvent('ai:job')).toBe(true);
    expect(isLiveEvent('ai:job.token')).toBe(true);
    expect(isLiveEvent('ai:agent.pulse')).toBe(true);
    expect(isLiveEvent('ai:agent.ask')).toBe(true);
    expect(isLiveEvent('ai:agent.ask.answered')).toBe(true);
    expect(isLiveEvent('ai:agent.done')).toBe(true);
    expect(isLiveEvent('log:appended')).toBe(true);
    expect(isLiveEvent('disconnect')).toBe(false);
  });

  test('project rooms require a matching project id', () => {
    const room = 'ai:live:aec3af8b-5250-4fd4-aa41-ca27654de029';
    expect(canJoinLiveRoom(room, { projectId: 'aec3af8b-5250-4fd4-aa41-ca27654de029' })).toBe(true);
    expect(canJoinLiveRoom(room, { projectId: 'ea370977-3aff-4c76-95a6-a0c50fd2bce7' })).toBe(false);
    expect(canJoinLiveRoom(room, {})).toBe(false);
    expect(canJoinLiveRoom('ai:live', {})).toBe(true);
  });
});
