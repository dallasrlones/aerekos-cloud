'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isPlaceholderToken } = require('./icarusLive');

test('isPlaceholderToken rejects empty and doc placeholders', () => {
  assert.equal(isPlaceholderToken(''), true);
  assert.equal(isPlaceholderToken('   '), true);
  assert.equal(isPlaceholderToken('replace-me'), true);
  assert.equal(isPlaceholderToken('REPLACE-WITH-REAL'), true);
  assert.equal(isPlaceholderToken('your_token_here'), true);
  assert.equal(isPlaceholderToken('changeme'), true);
  assert.equal(isPlaceholderToken('TODO'), true);
  assert.equal(isPlaceholderToken('xxx'), true);
});

test('isPlaceholderToken accepts non-placeholder tokens', () => {
  assert.equal(isPlaceholderToken('eyJhbGciOiJIUzI1NiJ9.x.y'), false);
  assert.equal(isPlaceholderToken('worker-shared-token'), false);
  assert.equal(isPlaceholderToken('not-a-placeholder-value'), false);
});
