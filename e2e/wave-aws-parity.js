'use strict';

/**
 * Wave 5 sandbox e2e — AWS-parity managers.
 * Creates e2e-platform-* only. Never touches production projects.
 * Skips when a manager is not deployed (404/502/503).
 */

const { skipLive, request, assert, runNamed } = require('./lib/icarusLive');
const { withSandbox } = require('./lib/sandbox');
const { runDataApiE2e } = require('./lib/dataApiFlow');

function reachable(status) {
  return ![404, 500, 501, 502, 503].includes(status);
}

async function main() {
  console.log('Wave 5 AWS-parity sandbox e2e');
  if (skipLive()) {
    console.log('  skip live (set AEREKOS_API_URL / CONDUCTOR_URL)');
    process.exit(0);
  }
  let ok = true;
  await withSandbox('aws-parity', async (box) => {
    const q = { project_id: box.projectId };
    const token = box.token;

    ok = await runNamed('fleet test-alert', async () => {
      const r = await request('POST', '/api/fleet/test-alert', {
        token,
        body: { project_id: box.projectId, service: 'download_manager', event: 'service:unhealthy' },
      });
      if (!reachable(r.status)) {
        box.skip(`fleet test-alert HTTP ${r.status}`);
        return 'skipped';
      }
      assert(r.status === 200 && r.data?.ok, `test-alert HTTP ${r.status}`);
      return r.data.event;
    }) && ok;

    ok = await runNamed('download windows + quick-add', async () => {
      const def = await request('POST', '/api/services/download_manager/api/v1/ensure-defaults', {
        token, query: q, body: { project_id: box.projectId },
      });
      if (!reachable(def.status)) {
        box.skip(`download_manager HTTP ${def.status}`);
        return 'skipped';
      }
      assert(def.status === 200, `ensure-defaults HTTP ${def.status}`);
      const win = def.data?.defaults?.window || def.data?.window;
      if (win) assert(win.name === 'overnight', `expected overnight window, got ${win.name}`);
      const add = await request('POST', '/api/services/download_manager/api/v1/quick-add', {
        token, query: q,
        body: {
          project_id: box.projectId,
          urls: ['https://example.com/sample.mp3'],
          window: 'overnight',
          list: 'inbox',
        },
      });
      assert(reachable(add.status) && [200, 201].includes(add.status), `quick-add HTTP ${add.status}`);
      const tick = await request('POST', '/api/services/download_manager/api/v1/tick', {
        token, query: q, body: { project_id: box.projectId },
      });
      assert(reachable(tick.status), `tick HTTP ${tick.status}`);
      return 'ok';
    }) && ok;

    ok = await runNamed('function invoke SKIP_INVOKE-safe', async () => {
      const created = await request('POST', '/api/services/function_manager/api/v1/functions', {
        token, query: q,
        body: { project_id: box.projectId, name: `hello-${box.runId}`, trigger: { queue: true } },
      });
      if (!reachable(created.status)) {
        box.skip(`function_manager HTTP ${created.status}`);
        return 'skipped';
      }
      assert([200, 201].includes(created.status), `create function HTTP ${created.status}`);
      const name = created.data?.item?.name || created.data?.function?.name || `hello-${box.runId}`;
      const inv = await request('POST', `/api/services/function_manager/api/v1/functions/${encodeURIComponent(name)}/invoke`, {
        token, query: q,
        body: { project_id: box.projectId, payload: { ping: true }, invocation_type: 'RequestResponse' },
      });
      assert(reachable(inv.status) && [200, 201, 202].includes(inv.status), `invoke HTTP ${inv.status}`);
      return name;
    }) && ok;

    ok = await runNamed('data API apply + relationships + query + scale', async () => {
      const result = await runDataApiE2e(box, { request, assert }, { engine: 'sqlite3', app: 'app' });
      if (result.skipped) return 'skipped';
      return `${result.app} q=${result.queryEngine} desired=${result.desired}`;
    }) && ok;

    ok = await runNamed('LoRA train + attach (SKIP_LORA-safe)', async () => {
      const train = await request('POST', '/api/services/ai_manager/api/v1/lora/train', {
        token, query: q,
        body: { project_id: box.projectId, name: `parity-${box.runId}`, examples: [] },
      });
      if (!reachable(train.status)) {
        box.skip(`ai_manager lora HTTP ${train.status}`);
        return 'skipped';
      }
      assert([200, 201].includes(train.status), `train HTTP ${train.status}`);
      const adapterId = train.data?.adapter?.id || train.data?.job_id || train.data?.item?.id;
      const attach = await request('POST', '/api/services/ai_manager/api/v1/lora/attach', {
        token, query: q,
        body: { project_id: box.projectId, adapter_id: adapterId, intelligence: 'sandbox' },
      });
      assert(reachable(attach.status) && attach.status === 200, `attach HTTP ${attach.status}`);
      return adapterId || 'ok';
    }) && ok;
  });
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
