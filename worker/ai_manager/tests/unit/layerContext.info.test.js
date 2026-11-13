'use strict';

const { laneInject, INFO_LANES } = require('../../api/services/layerContext');

describe('layerContext info lane', () => {
  test('info injects rag not memory', () => {
    expect(INFO_LANES.has('info')).toBe(true);
    expect(laneInject('info')).toEqual({ memory: false, rag: true });
  });

  test('user/talk still friend memory', () => {
    expect(laneInject('user')).toEqual({ memory: true, rag: false });
    expect(laneInject('talk')).toEqual({ memory: true, rag: false });
  });
});
