'use strict';

const { shouldDeadLetter, physicalName } = require('../../api/services/brokers');

describe('broker helpers', () => {
  test('physical names are project-scoped', () => {
    expect(physicalName('p1', 'inbox')).toBe('aerekos.p1.inbox');
  });

  test('dead-letters only when a DLQ is set and receive_count exceeds max', () => {
    expect(shouldDeadLetter(3, 3, 'q-dlq')).toBe(false);
    expect(shouldDeadLetter(4, 3, 'q-dlq')).toBe(true);
    expect(shouldDeadLetter(99, 3, '')).toBe(false);
  });
});
