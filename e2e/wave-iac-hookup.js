'use strict';

const { skipLive, assert, runNamed, request } = require('./lib/icarusLive');
const { withSandbox } = require('./lib/sandbox');
const { assertNotProdProject } = require('./lib/prodGuard');

async function waitHealth(token, projectId, service, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  let last = 0;
  while (Date.now() < deadline) {
    const r = await request('GET', `/api/services/${service}/health`, {
      token,
      query: { project_id: projectId },
    }).catch(() => ({ status: 0 }));
    last = r.status;
    if (r.status === 200) return true;
    await new Promise((ok) => setTimeout(ok, 2000));
  }
  throw new Error(`${service} health still ${last}`);
}

async function main() {
  console.log('Wave IaC hookup e2e');
  if (skipLive()) {
    console.log('  skip live');
    process.exit(0);
  }
  let ok = true;
  await withSandbox('iac', async (box) => {
    assertNotProdProject(box.projectId);
    const token = box.token;
    const pid = box.projectId;

    ok = await runNamed('hookup conductor → hooked_up', async () => {
      const hook = await request('POST', `/api/projects/${pid}/iac/hookup`, {
        token,
        body: { mode: 'conductor' },
        timeoutMs: 180000,
      });
      assert(hook.status === 200, `hookup HTTP ${hook.status}`);
      if (!hook.data?.hooked_up) {
        await waitHealth(token, pid, 'code_as_infra');
        const retry = await request('POST', `/api/projects/${pid}/iac/hookup`, {
          token,
          body: { mode: 'conductor' },
          timeoutMs: 180000,
        });
        assert(retry.data?.hooked_up === true, `still not hooked_up: ${JSON.stringify(retry.data).slice(0, 200)}`);
        return retry.data.mode;
      }
      return hook.data.mode;
    }) && ok;

    ok = await runNamed('status still hooked_up (banner would hide)', async () => {
      const st = await request('GET', `/api/projects/${pid}/iac/status`, { token });
      assert(st.status === 200 && st.data.hooked_up === true, `status ${JSON.stringify(st.data)}`);
      assert((st.data.missing || []).length === 0, `missing ${st.data.missing}`);
      return st.data.mode;
    }) && ok;

    ok = await runNamed('code_as_infra health 200', async () => {
      const h = await request('GET', '/api/services/code_as_infra/health', {
        token,
        query: { project_id: pid },
      });
      assert(h.status === 200, `health HTTP ${h.status}`);
      return String(h.status);
    }) && ok;

    ok = await runNamed('stack current not empty', async () => {
      const cur = await request('GET', `/api/projects/${pid}/stack`, { token });
      assert(cur.status === 200, `stack HTTP ${cur.status}`);
      assert(cur.data && cur.data.status !== 'empty', `empty stack ${JSON.stringify(cur.data).slice(0, 120)}`);
      return cur.data.status || 'ok';
    }) && ok;

    ok = await runNamed('hookup twice is idempotent', async () => {
      const again = await request('POST', `/api/projects/${pid}/iac/hookup`, {
        token,
        body: { mode: 'conductor' },
        timeoutMs: 180000,
      });
      assert(again.data?.hooked_up === true, `second hookup ${JSON.stringify(again.data).slice(0, 160)}`);
      return 'ok';
    }) && ok;
  });

  await withSandbox('iac-git', async (box) => {
    assertNotProdProject(box.projectId);
    const token = box.token;
    const pid = box.projectId;

    ok = await runNamed('hookup git → infra repo + stack.json', async () => {
      const hook = await request('POST', `/api/projects/${pid}/iac/hookup`, {
        token,
        body: { mode: 'git', repo: 'infra' },
        timeoutMs: 180000,
      });
      if (!hook.data?.hooked_up) {
        await waitHealth(token, pid, 'code_as_infra').catch(() => {});
        await waitHealth(token, pid, 'git_manager').catch(() => {});
        const retry = await request('POST', `/api/projects/${pid}/iac/hookup`, {
          token,
          body: { mode: 'git', repo: 'infra' },
          timeoutMs: 180000,
        });
        assert(retry.data?.hooked_up === true, `git hookup failed: ${JSON.stringify(retry.data).slice(0, 200)}`);
      }
      const listed = await request('GET', '/api/services/git_manager/api/v1/repos', {
        token,
        query: { project_id: pid },
      });
      assert(listed.status === 200, `repos HTTP ${listed.status}`);
      const repos = listed.data?.repositories || listed.data?.items || [];
      const infra = repos.find((r) => r.name === 'infra');
      assert(infra, 'infra repo missing');
      return infra.id.slice(0, 8);
    }) && ok;
  });

  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
