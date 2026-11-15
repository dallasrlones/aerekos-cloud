'use strict';

const { buildMemoryLookupQuery } = require('../../api/services/SmartMemoryLookupScaffold');

test('buildMemoryLookupQuery', () => {
  expect(buildMemoryLookupQuery({ goal: ' x ', limit: 3 })).toEqual({ goal: 'x', limit: 3, mode: 'laya+llm' });
});
