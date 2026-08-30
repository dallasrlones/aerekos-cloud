'use strict';

const { skipLive, assert, runNamed, request } = require('./lib/icarusLive');
const { withSandbox } = require('./lib/sandbox');
const { sdkClient } = require('./lib/sdk');

async function main() {
  console.log('Wave 4 systems manager e2e (no OS reboot)');
  if (skipLive()) {
    console.log('  skip live');
    process.exit(0);
  }
  let ok = true;
  await withSandbox('wave4', async (box) => {
    const client = sdkClient(box.token);

    ok = await runNamed('list version vs desired on registered devices', async () => {
      const r = await client.get('/api/fleet/updates');
      assert(Array.isArray(r.devices), 'devices missing');
      assert(r.devices.length >= 1, 'expected at least one device');
      return `${r.devices.length} device(s)`;
    }) && ok;

    ok = await runNamed('pause then delete run-now job records only', async () => {
      const pause = await client.post('/api/fleet/updates/pause', {
        project_id: box.projectId,
        hostname: 'e2e-device',
      });
      const pauseId = pause.job?.id;
      assert(pauseId, 'pause job missing');
      box.track({ kind: 'job', id: pauseId });
      const run = await client.post('/api/fleet/updates/run-now', {
        project_id: box.projectId,
        hostname: 'e2e-device',
      });
      const runId = run.job?.id;
      assert(runId, 'run-now job missing');
      box.track({ kind: 'job', id: runId });
      await request('DELETE', `/api/jobs/${pauseId}`, { token: box.token });
      await request('DELETE', `/api/jobs/${runId}`, { token: box.token });
      return 'jobs deleted';
    }) && ok;
  });
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
