const { isDirty, canSwitchRef, defaultCommitMessage } = require('../../app/screens/Adonis/dirtyGuard');

describe('adonis dirtyGuard', () => {
  test('isDirty detects changes', () => {
    expect(isDirty('a', 'a')).toBe(false);
    expect(isDirty('a', 'b')).toBe(true);
    expect(isDirty(null, '')).toBe(false);
  });

  test('canSwitchRef respects dirty + confirm', () => {
    expect(canSwitchRef({ dirty: false })).toBe(true);
    expect(canSwitchRef({ dirty: true, confirm: () => true })).toBe(true);
    expect(canSwitchRef({ dirty: true, confirm: () => false })).toBe(false);
    expect(canSwitchRef({ dirty: true })).toBe(false);
  });

  test('defaultCommitMessage', () => {
    expect(defaultCommitMessage('README.md')).toBe('Update README.md');
    expect(defaultCommitMessage('')).toBe('Update file');
  });
});
