'use strict';

const { skipLive, assert, runNamed, request } = require('./lib/icarusLive');
const { withSandbox } = require('./lib/sandbox');
const { assertNotProdProject } = require('./lib/prodGuard');

async function main() {
  console.log('Wave notify e2e');
  if (skipLive()) {
    console.log('  skip live');
    process.exit(0);
  }
  let ok = true;
  await withSandbox('notify', async (box) => {
    assertNotProdProject(box.projectId);
    const { token, projectId: pid } = box;

    for (const [svc, path, body] of [
      ['email_manager', '/api/v1/messages', { project_id: pid, to: 'e2e@example.com', subject: 'e2e', body: 'hi' }],
      ['sms_manager', '/api/v1/messages', { project_id: pid, to: '+15555550100', body: 'hi' }],
      ['slack_manager', '/api/v1/messages', { project_id: pid, text: 'e2e' }],
    ]) {
      ok = await runNamed(`${svc} create without provider secrets`, async () => {
        const created = await request('POST', `/api/services/${svc}${path}`, { token, body });
        assert(created.status < 500, `${svc} create HTTP ${created.status}`);
        const id = created.data?.item?.id;
        if (!id) return `queued-or-${created.status}`;
        const sent = await request('POST', `/api/services/${svc}${path}/${id}/send`, {
          token,
          body: { project_id: pid },
        });
        assert(sent.status < 500, `${svc} send HTTP ${sent.status}`);
        return String(sent.status);
      }) && ok;
    }

    ok = await runNamed('push send without FCM is not 500', async () => {
      const sent = await request('POST', '/api/services/push_manager/api/v1/send', {
        token,
        body: { project_id: pid, title: 'e2e', body: 'hi', to: 'none' },
      });
      assert(sent.status < 500, `push send HTTP ${sent.status}`);
      return String(sent.status);
    }) && ok;
  });
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
