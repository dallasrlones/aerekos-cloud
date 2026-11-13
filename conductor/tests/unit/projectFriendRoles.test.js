'use strict';

const { MEMBER_ROLES, normalizeRole, roleRank } = require('../../api/utils/projectRoles');

describe('project friend roles', () => {
  test('normalizes and ranks roles', () => {
    expect(MEMBER_ROLES).toEqual(['owner', 'member', 'viewer']);
    expect(normalizeRole('OWNER')).toBe('owner');
    expect(normalizeRole('nope', 'viewer')).toBe('viewer');
    expect(roleRank('owner')).toBeGreaterThan(roleRank('member'));
    expect(roleRank('member')).toBeGreaterThan(roleRank('viewer'));
  });
});
