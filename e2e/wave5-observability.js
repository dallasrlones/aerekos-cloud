'use strict';

const { skipLive, assert, runNamed } = require('./lib/icarusLive');
const { withSandbox } = require('./lib/sandbox');
const { sdkClient } = require('./lib/sdk');
const { sweepNamedProjects } = require('./cleanup-project');

async function main() {
  console.log('Wave 5 observability e2e + final sweep');
  if (skipLive()) {
    console.log('  skip live');
    process.exit(0);
  }
  let ok = true;
  await withSandbox('wave5', async (box) => {
    const client = sdkClient(box.token);
    const pid = box.projectId;

    ok = await runNamed('emit log line', async () => {
      const r = await client.proxy('logs_manager', {
        method: 'POST',
        path: '/api/v1/logs',
        projectId: pid,
        body: { project_id: pid, source: 'e2e', level: 'info', message: 'e2e-wave5' },
      });
      const log = r.log || r.item;
      assert(log && log.id, 'log missing');
      box.track({ kind: 'log', id: log.id });
      await client.proxy('logs_manager', {
        method: 'DELETE',
        path: `/api/v1/logs/${log.id}`,
        projectId: pid,
      }).catch(() => {});
      return log.id.slice(0, 8);
    }) && ok;

    ok = await runNamed('emit analytics event', async () => {
      const r = await client.proxy('analytics_manager', {
        method: 'POST',
        path: '/api/v1/events',
        projectId: pid,
        body: { project_id: pid, name: `e2e-event-${box.runId}`, event_type: 'e2e' },
      });
      const item = r.item || r;
      assert(item.id, 'analytics item missing');
      box.track({ kind: 'analytics', id: item.id });
      await client.proxy('analytics_manager', {
        method: 'DELETE',
        path: `/api/v1/events/${item.id}`,
        projectId: pid,
      });
      return item.id.slice(0, 8);
    }) && ok;

    ok = await runNamed('scrape healthy_host_count metric', async () => {
      const name = `e2e-hhc-${box.runId}`;
      const r = await client.proxy('metrics_manager', {
        method: 'POST',
        path: '/api/v1/series',
        projectId: pid,
        body: {
          project_id: pid,
          name,
          metric_name: 'healthy_host_count',
          value: '1',
          labels: '{}',
        },
      });
      const item = r.item || r;
      box.track({ kind: 'metric', id: item.id });
      await client.proxy('metrics_manager', {
        method: 'DELETE',
        path: `/api/v1/series/${item.id}`,
        projectId: pid,
      });
      return name;
    }) && ok;
  });

  if (ok) {
    await sweepNamedProjects();
    console.log('  final sweep of e2e-platform-* complete');
  }
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
