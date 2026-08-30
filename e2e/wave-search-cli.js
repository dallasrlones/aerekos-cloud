'use strict';

const path = require('path');
const { spawnSync } = require('child_process');
const { skipLive, assert, runNamed, request, env, conductorBase } = require('./lib/icarusLive');
const { withSandbox } = require('./lib/sandbox');
const { assertNotProdProject } = require('./lib/prodGuard');

async function main() {
  console.log('Wave search / export / CDN / CLI e2e');
  if (skipLive()) {
    console.log('  skip live');
    process.exit(0);
  }
  let ok = true;
  await withSandbox('search-cli', async (box) => {
    assertNotProdProject(box.projectId);
    const { token, projectId: pid } = box;

    ok = await runNamed('GET /api/search', async () => {
      const r = await request('GET', '/api/search', { token, query: { q: 'e2e' } });
      assert(r.status === 200, `search HTTP ${r.status}`);
      assert(Array.isArray(r.data.items), 'items');
      assert(r.data.items.length <= 50, 'cap 50');
      return String(r.data.items.length);
    }) && ok;

    ok = await runNamed('export then import onto second sandbox project', async () => {
      const exp = await request('GET', `/api/projects/${pid}/export`, { token });
      assert(exp.status === 200, `export HTTP ${exp.status}`);
      const created = await request('POST', '/api/projects', {
        token,
        body: { name: `e2e-platform-import-${Date.now()}`, description: 'import target' },
      });
      const dest = created.data?.project?.id || created.data?.id;
      assertNotProdProject(dest);
      box.track({ kind: 'project', id: dest });
      const imp = await request('POST', `/api/projects/${dest}/import`, {
        token,
        body: { project: exp.data.project },
      });
      assert(imp.status === 200 && imp.data.imported === true, `import HTTP ${imp.status}`);
      return dest.slice(0, 8);
    }) && ok;

    ok = await runNamed('cdn cache/WAF without CF token is structured', async () => {
      const r = await request('POST', '/api/services/cdn_manager/api/v1/purge', {
        token,
        body: { project_id: pid },
      });
      assert(r.status !== 500, `cdn purge 500: ${JSON.stringify(r.data).slice(0, 120)}`);
      return String(r.status);
    }) && ok;
  });

  ok = await runNamed('aerekos setup status / vpc status', async () => {
    const bin = path.join(__dirname, '../aerekos-sdk/bin/aerekos.js');
    const base = conductorBase();
    const token = env('AEREKOS_C0_ADMIN_TOKEN') || env('TOKEN') || '';
    const args = (cmd) => [bin, ...cmd, '--url', base, ...(token ? ['--token', token] : [])];
    const setup = spawnSync(process.execPath, args(['setup', 'status', '--project', 'e2e-cli']), {
      encoding: 'utf8',
      timeout: 20000,
    });
    const vpc = spawnSync(process.execPath, args(['vpc', 'status']), { encoding: 'utf8', timeout: 20000 });
    assert(setup.status === 0 || /login|token|project/i.test(setup.stderr + setup.stdout),
      `setup status failed: ${setup.stdout} ${setup.stderr}`);
    assert(vpc.status === 0 || /login|token|vpc/i.test(vpc.stderr + vpc.stdout),
      `vpc status failed: ${vpc.stdout} ${vpc.stderr}`);
    return `setup=${setup.status} vpc=${vpc.status}`;
  }) && ok;

  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
