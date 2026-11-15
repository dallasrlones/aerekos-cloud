'use strict';

const { buildPersonalityContext } = require('../../api/services/PersonalityContextScaffold');

test('buildPersonalityContext', () => {
  const c = buildPersonalityContext({ personality: { tone: 'direct' }, goals: ['ship'], now: '2026-01-01T00:00:00.000Z' });
  expect(c.personality.tone).toBe('direct');
  expect(c.goals).toEqual(['ship']);
  expect(c.datetime).toBe('2026-01-01T00:00:00.000Z');
});
