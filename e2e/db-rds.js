'use strict';
const { skipLive, request, adminToken, mintAppToken, env, assert, runNamed } = require('./lib/icarusLive');

async function live() {
  const admin = await adminToken();
  const projectId = env('AEREKOS_PROJECT_ID');
  const token = await mintAppToken(admin, projectId);
  const name = `icarus-t39-${Date.now().toString(36)}`;
  const created = await request('POST', '/api/services/db_manager/api/databases', {
    token, query: { project_id: projectId },
    body: { name, type: 'sqlite3' },
  });
  assert([200, 201].includes(created.status), `provision HTTP ${created.status}: ${JSON.stringify(created.data).slice(0, 240)}`);
  const listed = await request('GET', '/api/services/db_manager/api/databases', {
    token, query: { project_id: projectId },
  });
  assert(listed.status === 200, `list HTTP ${listed.status}`);
  const rows = listed.data?.databases || listed.data?.items || [];
  assert(rows.some((d) => (d.name || d.database?.name) === name || d === name), `sqlite3 ${name} missing from list`);
  return name;
}

async function main() {
  console.log('Icarus T39 db-rds');
  if (skipLive()) {
    console.log('  skip live (ICARUS_C0_SKIP_LIVE=1)');
    process.exit(0);
  }
  const ok = await runNamed('live: provision sqlite3 + list', live);
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
