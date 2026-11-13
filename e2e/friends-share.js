'use strict';

/**
 * Friends + shared projects live e2e (Phase 1 GA).
 *
 * Flow: owner creates project → invites (optional email) → friend accepts →
 * outsider 403 → viewer write denial → leave → clear (creator-only open).
 * Also checks ai_manager proxy membership gate and LiveRoom allowlist.
 *
 * Env:
 *   AEREKOS_API_URL | CONDUCTOR_URL
 *   AEREKOS_C0_ADMIN_TOKEN | TOKEN   optional; else AUTH_USERNAME/AUTH_PASSWORD (admin)
 *   ICARUS_C0_SKIP_LIVE=1           skip
 */

const { skipLive, request, adminToken, assert, runNamed, env } = require('./lib/icarusLive');
const { assertNotProdProject } = require('./lib/prodGuard');

async function login(username, password) {
  const r = await request('POST', '/api/auth/login', { body: { username, password } });
  assert(r.status === 200 && r.data?.token, `login ${username} HTTP ${r.status}`);
  return { token: r.data.token, user: r.data.user };
}

async function ensureUser(adminTok, { username, email, password }) {
  const created = await request('POST', '/api/auth/users', {
    token: adminTok,
    body: { username, email, password, role: 'user' },
  });
  if (created.status === 201 && created.data?.user?.id) {
    return created.data.user;
  }
  if (created.status === 409) {
    const logged = await login(username, password);
    return logged.user;
  }
  throw new Error(`create user ${username} HTTP ${created.status}: ${JSON.stringify(created.data).slice(0, 180)}`);
}

async function friendsFlow() {
  const adminTok = await adminToken();
  const runId = Date.now().toString(36);
  const pass = env('E2E_FRIEND_PASSWORD') || `fr-${runId}-pass`;

  const ownerUser = await ensureUser(adminTok, {
    username: `fr-owner-${runId}`,
    email: `fr-owner-${runId}@e2e.aerekos.cloud`,
    password: pass,
  });
  const friendUser = await ensureUser(adminTok, {
    username: `fr-friend-${runId}`,
    email: `fr-friend-${runId}@e2e.aerekos.cloud`,
    password: pass,
  });
  const outsiderUser = await ensureUser(adminTok, {
    username: `fr-out-${runId}`,
    email: `fr-out-${runId}@e2e.aerekos.cloud`,
    password: pass,
  });

  const owner = await login(ownerUser.username, pass);
  const friend = await login(friendUser.username, pass);
  const outsider = await login(outsiderUser.username, pass);

  const created = await request('POST', '/api/projects', {
    token: owner.token,
    body: { name: `e2e-friends-${runId}`, description: 'friends share e2e' },
  });
  assert(created.status === 201 || created.status === 200, `create project HTTP ${created.status}`);
  const projectId = created.data?.project?.id || created.data?.id;
  assert(projectId, 'project id missing');
  assertNotProdProject(projectId);

  const invite = await request('POST', `/api/projects/${projectId}/invites`, {
    token: owner.token,
    body: { role: 'member', email: friendUser.email },
  });
  assert(invite.status === 201, `create invite HTTP ${invite.status}: ${JSON.stringify(invite.data).slice(0, 160)}`);
  assert(invite.data?.invite?.token, 'invite token missing');
  assert(invite.data?.invite?.email === friendUser.email, 'invite email persisted');
  assert(invite.data?.maturity === 'ga', 'maturity should be ga');

  const members1 = await request('GET', `/api/projects/${projectId}/members`, { token: owner.token });
  assert(members1.status === 200, `list members HTTP ${members1.status}`);
  assert(
    (members1.data?.members || []).some((m) => m.user_id === owner.user.id && m.role === 'owner' && m.status === 'active'),
    'owner bootstrap missing',
  );

  const accepted = await request('POST', '/api/projects/invites/accept', {
    token: friend.token,
    body: { token: invite.data.invite.token },
  });
  assert(accepted.status === 200, `accept HTTP ${accepted.status}: ${JSON.stringify(accepted.data).slice(0, 160)}`);
  assert(accepted.data?.member?.user_id === friend.user.id, 'friend member id');
  assert(accepted.data?.member?.status === 'active', 'friend status active');

  const asFriend = await request('GET', `/api/projects/${projectId}`, { token: friend.token });
  assert(asFriend.status === 200, `friend project GET HTTP ${asFriend.status}`);

  const asOut = await request('GET', `/api/projects/${projectId}`, { token: outsider.token });
  assert(asOut.status === 403, `outsider should 403, got ${asOut.status}`);
  assert(asOut.data?.error?.code === 'PROJECT_MEMBER_REQUIRED', 'outsider code');

  const proxyOut = await request('GET', '/api/services/ai_manager/api/v1/agents', {
    token: outsider.token,
    query: { project_id: projectId },
    headers: { 'X-Project-Id': projectId },
  });
  assert(proxyOut.status === 403, `outsider ai_manager proxy should 403, got ${proxyOut.status}`);

  const proxyFriend = await request('GET', '/api/services/ai_manager/api/v1/agents', {
    token: friend.token,
    query: { project_id: projectId },
    headers: { 'X-Project-Id': projectId },
  });
  assert(
    proxyFriend.status !== 403 || proxyFriend.data?.error?.code !== 'PROJECT_MEMBER_REQUIRED',
    `friend ai_manager blocked by membership: HTTP ${proxyFriend.status}`,
  );

  // Promote friend to viewer and deny writes
  const rolePatch = await request('PATCH', `/api/projects/${projectId}/members/${friend.user.id}`, {
    token: owner.token,
    body: { role: 'viewer' },
  });
  assert(rolePatch.status === 200, `role patch HTTP ${rolePatch.status}`);
  const viewerWrite = await request('POST', `/api/projects/${projectId}/environments`, {
    token: friend.token,
    body: { name: `viewer-denied-${runId}` },
  });
  assert(viewerWrite.status === 403, `viewer write should 403, got ${viewerWrite.status}`);
  const viewerProxyWrite = await request('POST', '/api/services/ai_manager/api/v1/agents', {
    token: friend.token,
    query: { project_id: projectId },
    headers: { 'X-Project-Id': projectId },
    body: { name: `viewer-agent-${runId}` },
  });
  assert(viewerProxyWrite.status === 403, `viewer ai_manager write should 403, got ${viewerProxyWrite.status}`);

  // Restore member for leave path
  const roleBack = await request('PATCH', `/api/projects/${projectId}/members/${friend.user.id}`, {
    token: owner.token,
    body: { role: 'member' },
  });
  assert(roleBack.status === 200, `role restore HTTP ${roleBack.status}`);

  const live = await request('POST', '/api/live', {
    token: owner.token,
    body: {
      room: `ai:live:${projectId}`,
      event: 'ai:friend.presence',
      data: { action: 'ping', status: 'active', peers: [] },
    },
  });
  assert(live.status === 200, `live presence event HTTP ${live.status}: ${JSON.stringify(live.data).slice(0, 120)}`);

  const liveOut = await request('POST', '/api/live', {
    token: outsider.token,
    body: {
      room: `ai:live:${projectId}`,
      event: 'ai:friend.presence',
      data: { action: 'probe' },
    },
  });
  assert(liveOut.status === 403, `outsider live broadcast should 403, got ${liveOut.status}`);

  // re-invite friend for leave path
  const invite2 = await request('POST', `/api/projects/${projectId}/invites`, {
    token: owner.token,
    body: { role: 'member' },
  });
  assert(invite2.status === 201, `re-invite HTTP ${invite2.status}`);
  const accepted2 = await request('POST', '/api/projects/invites/accept', {
    token: friend.token,
    body: { token: invite2.data.invite.token },
  });
  assert(accepted2.status === 200, `re-accept HTTP ${accepted2.status}`);

  const left = await request('POST', `/api/projects/${projectId}/members/leave`, { token: friend.token, body: {} });
  assert(left.status === 200, `leave HTTP ${left.status}`);
  const friendLeft = await request('GET', `/api/projects/${projectId}`, { token: friend.token });
  assert(friendLeft.status === 403, `left friend should 403, got ${friendLeft.status}`);

  const cleared = await request('POST', `/api/projects/${projectId}/members/clear`, {
    token: owner.token,
    body: {},
  });
  assert(cleared.status === 200, `clear HTTP ${cleared.status}`);
  assert(cleared.data?.status === 'open', 'cleared status open');
  // created_by remains owner — strangers cannot see/bootstrap foreign open projects
  const outsiderOpen = await request('GET', `/api/projects/${projectId}`, { token: outsider.token });
  assert(outsiderOpen.status === 403, `foreign open project should 403 outsider, got ${outsiderOpen.status}`);
  const ownerOpen = await request('GET', `/api/projects/${projectId}`, { token: owner.token });
  assert(ownerOpen.status === 200, `creator should still see open project, got ${ownerOpen.status}`);
  const strangerInvite = await request('POST', `/api/projects/${projectId}/invites`, {
    token: outsider.token,
    body: { role: 'member' },
  });
  assert(strangerInvite.status === 403, `stranger bootstrap should 403, got ${strangerInvite.status}`);

  // cleanup best-effort
  await request('DELETE', `/api/projects/${projectId}`, { token: adminTok }).catch(() => {});

  return `project=${projectId} invite+viewer-deny+leave+clear ok`;
}

async function main() {
  console.log('Friends share e2e');
  if (skipLive()) {
    console.log('  skip (no CONDUCTOR_URL / ICARUS_C0_SKIP_LIVE=1)');
    process.exit(0);
  }
  const ok = await runNamed('live: invite → accept → gate → leave → clear', friendsFlow);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
