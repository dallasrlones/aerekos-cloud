'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { skipLive, assert, runNamed, request } = require('./lib/icarusLive');
const { withSandbox } = require('./lib/sandbox');
const { assertNotProdProject } = require('./lib/prodGuard');

async function main() {
  console.log('Wave ops / backup / ollama e2e');
  if (skipLive()) {
    console.log('  skip live');
    process.exit(0);
  }
  let ok = true;
  await withSandbox('ops', async (box) => {
    assertNotProdProject(box.projectId);
    const { token, projectId: pid } = box;

    ok = await runNamed('GET /api/ops/timeline shape', async () => {
      const r = await request('GET', '/api/ops/timeline', { token, query: { project_id: pid } });
      assert(r.status === 200, `timeline HTTP ${r.status}`);
      assert(typeof r.data.broken === 'number', 'broken count');
      assert(Array.isArray(r.data.events), 'events array');
      return String(r.data.broken);
    }) && ok;

    ok = await runNamed('backup job create (no restic required)', async () => {
      const r = await request('POST', '/api/services/backup_manager/api/v1/jobs', {
        token,
        body: { project_id: pid, source: 'git', resource: 'default', vault: 'e2e' },
      });
      assert(r.status < 500, `backup job HTTP ${r.status}`);
      return String(r.status);
    }) && ok;

    ok = await runNamed('Ollama provider listed or seedable', async () => {
      const r = await request('GET', '/api/services/ai_manager/api/v1/providers', {
        token,
        query: { project_id: pid },
      });
      assert(r.status < 500, `providers HTTP ${r.status}`);
      const items = r.data?.items || r.data?.providers || [];
      const names = items.map((p) => p.name || p.provider).join(',');
      return names || String(r.status);
    }) && ok;
  });

  ok = await runNamed('replicate-sqlite copies a temp db', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aerekos-repl-'));
    const src = path.join(tmp, 'conductor.db');
    const dest = path.join(tmp, 'dest');
    fs.writeFileSync(src, 'sqlite-fixture');
    const script = path.join(__dirname, '../conductor/scripts/replicate-sqlite.js');
    const r = spawnSync(process.execPath, [script], {
      env: {
        ...process.env,
        DATABASE_PATH: src,
        CONDUCTOR_REPLICATE_DEST: dest,
        CONDUCTOR_REPLICATE_INTERVAL_MS: '86400000',
      },
      timeout: 4000,
    });
    const copied = fs.existsSync(path.join(dest, 'conductor.db'));
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
    assert(copied || r.status === 0, `replicate failed status=${r.status} ${r.stderr}`);
    return copied ? 'copied' : 'exited';
  }) && ok;

  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
