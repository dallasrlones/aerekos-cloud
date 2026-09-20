'use strict';

const mockEmit = jest.fn();
jest.mock('../../../shared/liveEmit', () => ({
  liveEmitSoon: (...args) => mockEmit(...args),
}));

const { emitPull, emitAgentPulse } = require('../../api/utils/aiLive');

describe('emitPull throttle', () => {
  beforeEach(() => mockEmit.mockClear());

  test('skips near-duplicate progress', () => {
    emitPull({ model: 'm', percent: 10, status: 'pulling' }, 'p1', false);
    emitPull({ model: 'm', percent: 10, status: 'pulling' }, 'p1', false);
    expect(mockEmit).toHaveBeenCalledTimes(1);
  });

  test('always emits terminal status', () => {
    emitPull({ model: 'm', percent: 10, status: 'pulling' }, 'p1', true);
    emitPull({ model: 'm', percent: 100, status: 'success' }, 'p1', true);
    expect(mockEmit).toHaveBeenCalledTimes(2);
    expect(mockEmit.mock.calls[1][1]).toBe('ai:pull');
  });

  test('emits agent pulse on ai:live room', () => {
    emitAgentPulse({ agent: { id: 'a1' } }, 'p1');
    expect(mockEmit).toHaveBeenCalledWith('ai:live:p1', 'ai:agent.pulse', expect.objectContaining({
      pulse: { agent: { id: 'a1' } },
    }));
  });
});
