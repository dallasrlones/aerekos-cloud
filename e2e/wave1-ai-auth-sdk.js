'use strict';

/**
 * Wave 1 e2e — gateway seed, SDK auth/invoke/intelligence/usage.
 * STT/TTS SKIP if no sidecar. Cleans up the sandbox project.
 */

const { skipLive, assert, runNamed } = require('./lib/icarusLive');
const { withSandbox } = require('./lib/sandbox');
const { sdkClient } = require('./lib/sdk');

async function main() {
  console.log('Wave 1 AI/auth/SDK e2e');
  if (skipLive()) {
    console.log('  skip live (set AEREKOS_API_URL / CONDUCTOR_URL)');
    process.exit(0);
  }
  let ok = true;
  await withSandbox('wave1', async (box) => {
    const client = sdkClient(box.token);

    ok = await runNamed('seed presets via SDK proxy', async () => {
      const r = await client.proxy('api_manager', {
        method: 'POST',
        path: '/api/v1/endpoints/seed-presets',
        projectId: box.projectId,
        body: { project_id: box.projectId },
      });
      assert(r && (r.created || r.updated), 'seed presets returned empty');
      return `${(r.created || []).length} created`;
    }) && ok;

    ok = await runNamed('pretty_invoke_url on list', async () => {
      const r = await client.proxy('api_manager', {
        path: '/api/v1/endpoints',
        projectId: box.projectId,
      });
      const items = r.items || [];
      assert(items.length > 0, 'no gateway routes');
      assert(items.some((i) => i.pretty_invoke_url), 'pretty_invoke_url missing');
      return String(items.length);
    }) && ok;

    ok = await runNamed('match intelligence chat path', async () => {
      const path = `/v1/projects/${box.projectId}/ai/intelligence/e2e/chat`;
      const r = await client.proxy('api_manager', {
        method: 'POST',
        path: '/api/v1/endpoints/match',
        projectId: box.projectId,
        body: { method: 'POST', path, project_id: box.projectId },
      });
      assert(r.match, 'no match');
      assert(r.match.target_service === 'ai_manager', 'wrong target');
      return r.match.name;
    }) && ok;

    ok = await runNamed('app credential create + getAppToken', async () => {
      const created = await client.proxy('auth_manager', {
        method: 'POST',
        path: '/api/v1/credentials',
        projectId: box.projectId,
        body: {
          project_id: box.projectId,
          name: 'e2e-app',
          allowed_resources: [`arn:aerekos:${box.projectId}:ai:*`],
          scopes: ['ai:InvokeIntelligence'],
        },
      });
      const cred = created.credential || created.item;
      assert(created.client_secret, 'client_secret shown once');
      box.track({ kind: 'credential', id: cred.id });
      const app = sdkClient();
      const tok = await app.auth.getAppToken({
        clientId: created.client_id,
        clientSecret: created.client_secret,
        projectId: box.projectId,
      });
      assert(tok.access_token || tok.token, 'no app token');
      return created.client_id.slice(0, 12);
    }) && ok;

    const hasAi = box.fleet.hasAi;
    if (!hasAi) {
      box.skip('intelligence chat (no ai role / LLM)');
    } else {
      ok = await runNamed('intelligence CRUD + usage list', async () => {
        const created = await client.intelligence.create(box.projectId, {
          name: 'e2e-intel',
          description: 'sandbox',
        });
        const item = created.item || created;
        box.track({ kind: 'intelligence', id: item.id });
        const usage = await client.intelligence.usage(box.projectId, { user_id: 'e2e' });
        assert(Array.isArray(usage.items), 'usage.items missing');
        return item.name;
      }) && ok;
    }

    try {
      const stt = await client.stt.status(box.projectId);
      if (!stt || stt.status === 'down') box.skip('STT sidecar not running');
    } catch {
      box.skip('STT sidecar not running');
    }
    try {
      const tts = await client.tts.status(box.projectId);
      if (!tts || tts.status === 'down') box.skip('TTS sidecar not running');
    } catch {
      box.skip('TTS sidecar not running');
    }
  });
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
