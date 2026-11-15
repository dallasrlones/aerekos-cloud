'use strict';

const { percentDone } = require('../../api/services/TaskGraphScaffold');

test('percentDone', () => {
  expect(percentDone([])).toBe(0);
  expect(percentDone([{ status: 'done' }, { status: 'open' }])).toBe(50);
});
