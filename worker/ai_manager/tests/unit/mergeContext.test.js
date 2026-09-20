'use strict';

const { mergeContext } = require('../../api/utils/mergeContext');

describe('mergeContext', () => {
  test('joins non-empty parts', () => {
    expect(mergeContext(['## A', '', '  ## B  '])).toBe('## A\n\n## B');
  });
  test('empty', () => {
    expect(mergeContext([])).toBe('');
    expect(mergeContext(null)).toBe('');
  });
});
