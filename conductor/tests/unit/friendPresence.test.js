'use strict';

const FriendPresence = require('../../api/services/FriendPresence');

describe('FriendPresence', () => {
  const room = 'ai:live:aec3af8b-5250-4fd4-aa41-ca27654de029';

  test('join leave and list', () => {
    FriendPresence.leaveAll('sock-a');
    FriendPresence.leaveAll('sock-b');
    const peers = FriendPresence.join(room, 'sock-a', {
      userId: 'u1',
      username: 'alice',
      projectId: 'aec3af8b-5250-4fd4-aa41-ca27654de029',
    });
    expect(peers.some((p) => p.user_id === 'u1' && p.status === 'active')).toBe(true);
    FriendPresence.join(room, 'sock-b', { userId: 'u2', username: 'bob' });
    expect(FriendPresence.list(room).length).toBe(2);
    FriendPresence.leave(room, 'sock-a');
    expect(FriendPresence.list(room).map((p) => p.user_id)).toEqual(['u2']);
    const touched = FriendPresence.leaveAll('sock-b');
    expect(touched).toContain(room);
    expect(FriendPresence.list(room).length).toBe(0);
  });
});
