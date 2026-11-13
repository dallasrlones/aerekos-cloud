'use strict';

/**
 * Friends federation live e2e (Phase 2 Preview).
 *
 * Single-conductor loopback: register self as peer → mint grant → attach → status →
 * proxy home project read. Optionally set SECOND_CONDUCTOR_URL for two-host smoke.
 *
 * Env:
 *   AEREKOS_API_URL | CONDUCTOR_URL
 *   SECOND_CONDUCTOR_URL   optional remote
 *   AEREKOS_C0_ADMIN_TOKEN | TOKEN
 *   ICARUS_C0_SKIP_LIVE=1
 */

const { skipLive, request, adminToken, assert, runNamed, env } = require('./lib/icarusLive');
const { assertNotProdProject } = require('./lib/prodGuard');

async function federationLoopback() {
  const adminTok = await adminToken();
  const runId = Date.now().toString(36);

  const created = await request('POST', '/api/projects', {
    token: adminTok,
    body: { name: `e2e-fed-${runId}`, description: 'friends federation e2e' },
  });
  assert(created.status === 201 || created.status === 200, `create project HTTP ${created.status}`);
  const projectId = created.data?.project?.id || created.data?.id;
  assert(projectId, 'project id');
  assertNotProdProject(projectId);

  const card = await request('GET', '/api/federation/peer', { token: adminTok });
  assert(card.status === 200, `peer card HTTP ${card.status}`);
  assert(card.data?.peer?.peer_id, 'peer_id');
  assert(card.data?.maturity === 'preview', 'federation maturity preview');

  const trusted = await request('POST', '/api/federation/peers', {
    token: adminTok,
    body: card.data.peer,
  });
  assert(trusted.status === 201, `trust peer HTTP ${trusted.status}`);

  const minted = await request('POST', `/api/projects/${projectId}/federation/grants`, {
    token: adminTok,
    body: { role: 'member' },
  });
  assert(minted.status === 201, `mint grant HTTP ${minted.status}: ${JSON.stringify(minted.data).slice(0, 160)}`);
  assert(minted.data?.token, 'grant token');

  const attached = await request('POST', '/api/federation/attach', {
    token: adminTok,
    body: { token: minted.data.token, label: `loop-${runId}` },
  });
  assert(attached.status === 201, `attach HTTP ${attached.status}: ${JSON.stringify(attached.data).slice(0, 160)}`);
  const attachId = attached.data?.attach?.id;
  assert(attachId, 'attach id');

  const status = await request('GET', `/api/federation/attaches/${attachId}/status`, { token: adminTok });
  assert(status.status === 200, `status HTTP ${status.status}`);
  assert(
    ['connecting', 'active', 'degraded', 'disconnected'].includes(status.data?.status),
    `unexpected status ${status.data?.status}`,
  );

  const proxied = await request('GET', `/api/federation/attaches/${attachId}/project`, { token: adminTok });
  assert(
    proxied.status === 200 || proxied.status === 502 || proxied.status === 401 || proxied.status === 403,
    `proxy project HTTP ${proxied.status}`,
  );
  if (proxied.status === 200) {
    const name = proxied.data?.project?.name || proxied.data?.name;
    assert(name, 'proxied project name');
  }

  await request('DELETE', `/api/federation/attaches/${attachId}`, { token: adminTok });
  await request('DELETE', `/api/projects/${projectId}`, { token: adminTok }).catch(() => {});

  return `attach=${attachId} status=${status.data?.status} proxy=${proxied.status}`;
}

async function federationRemoteIfConfigured() {
  const remote = env('SECOND_CONDUCTOR_URL');
  if (!remote) return 'skip (no SECOND_CONDUCTOR_URL)';

  // Keep as a soft probe — full two-host attach requires cross-host peer trust.
  const adminTok = await adminToken();
  const card = await request('GET', '/api/federation/peer', { token: adminTok });
  assert(card.status === 200, 'local peer card');
  const remoteCard = await fetch(`${String(remote).replace(/\/$/, '')}/api/federation/peer`, {
    headers: { Authorization: `Bearer ${adminTok}`, Accept: 'application/json' },
  }).catch((err) => ({ ok: false, error: err }));
  if (!remoteCard.ok) return `remote unreachable: ${remoteCard.error?.message || remoteCard.status}`;
  return 'remote peer reachable';
}

async function main() {
  console.log('Friends federation e2e');
  if (skipLive()) {
    console.log('  skip (no CONDUCTOR_URL / ICARUS_C0_SKIP_LIVE=1)');
    process.exit(0);
  }
  const a = await runNamed('live: loopback peer→grant→attach→status', federationLoopback);
  const b = await runNamed('live: optional second conductor', federationRemoteIfConfigured);
  process.exit(a && b ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
