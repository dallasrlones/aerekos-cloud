'use strict';

const { skipLive, assert, runNamed, request } = require('./lib/icarusLive');
const { withSandbox } = require('./lib/sandbox');
const { assertNotProdProject } = require('./lib/prodGuard');

async function main() {
  console.log('Wave edge hookup e2e');
  if (skipLive()) {
    console.log('  skip live');
    process.exit(0);
  }
  let ok = true;
  await withSandbox('edge', async (box) => {
    assertNotProdProject(box.projectId);
    const { token, projectId: pid } = box;

    ok = await runNamed('edge status is honest without CF secrets', async () => {
      const st = await request('GET', `/api/projects/${pid}/edge/status`, { token });
      assert(st.status === 200, `status HTTP ${st.status}`);
      if (!st.data.hooked_up) {
        assert(
          (st.data.missing || []).some((m) => String(m).includes('cloudflare') || m === 'tunnel_manager' || m === 'domain_manager'),
          `expected honest missing, got ${JSON.stringify(st.data.missing)}`,
        );
      }
      return st.data.hooked_up ? 'hooked' : (st.data.missing || []).join(',');
    }) && ok;

    ok = await runNamed('edge hookup does not invent a CF account', async () => {
      const hook = await request('POST', `/api/projects/${pid}/edge/hookup`, { token, body: {}, timeoutMs: 180000 });
      assert(hook.status === 200, `hookup HTTP ${hook.status}`);
      if (!hook.data.hooked_up) {
        assert((hook.data.missing || []).length > 0 || hook.data.message, 'failed hookup must explain missing secrets');
      }
      return hook.data.hooked_up ? 'ready' : 'honest-false';
    }) && ok;

    ok = await runNamed('import-tunnels without token is not a live CF call success', async () => {
      const imp = await request('POST', `/api/projects/${pid}/edge/import-tunnels`, { token, body: {} });
      assert(imp.status !== 200 || imp.data.imported === 0 || imp.data.tunnels || imp.data.error || !imp.data.hooked_up,
        `unexpected import success: ${JSON.stringify(imp.data).slice(0, 160)}`);
      return String(imp.status);
    }) && ok;
  });
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
