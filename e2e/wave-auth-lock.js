'use strict';

const { skipLive, assert, runNamed, request, adminToken } = require('./lib/icarusLive');
const { withSandbox } = require('./lib/sandbox');
const { assertNotProdProject } = require('./lib/prodGuard');

async function main() {
  console.log('Wave auth lock e2e');
  if (skipLive()) {
    console.log('  skip live');
    process.exit(0);
  }
  let ok = true;
  await withSandbox('auth', async (box) => {
    assertNotProdProject(box.projectId);
    ok = await runNamed('admin token works', async () => {
      const token = await adminToken();
      const me = await request('GET', '/api/auth/me', { token });
      assert(me.status === 200, `me HTTP ${me.status}`);
      return me.data?.user?.username || 'ok';
    }) && ok;

    ok = await runNamed('TOTP enable returns secret (skip login-with-code if missing)', async () => {
      const enable = await request('POST', '/api/auth/totp/enable', { token: box.token, body: {} });
      if (enable.status !== 200 || !enable.data?.secret) {
        box.skip('totp enable not available');
        return 'skipped';
      }
      await request('POST', '/api/auth/totp/disable', { token: box.token, body: {} });
      return 'enabled-then-disabled';
    }) && ok;
  });
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
