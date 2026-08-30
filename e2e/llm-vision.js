'use strict';
const { skipLive, request, adminToken, mintAppToken, env, assert, runNamed } = require('./lib/icarusLive');

const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function live() {
  const admin = await adminToken();
  const projectId = env('AEREKOS_PROJECT_ID');
  const token = await mintAppToken(admin, projectId);
  const model = env('AEREKOS_VISION_MODEL') || 'gemma3:4b-it-qat';
  const chat = await request('POST', '/api/services/ai_manager/api/v1/llm/chat', {
    token,
    query: { project_id: projectId },
    timeoutMs: parseInt(env('LLM_INFERENCE_TIMEOUT_MS') || '1800000', 10),
    body: {
      project_id: projectId,
      model,
      messages: [{
        role: 'user',
        content: 'Reply with the single word pong.',
        images: [PIXEL],
      }],
    },
  });
  assert(chat.status === 200, `vision chat HTTP ${chat.status}: ${JSON.stringify(chat.data).slice(0, 240)}`);
  const text = chat.data?.message?.content || chat.data?.choices?.[0]?.message?.content || '';
  assert(String(text).length > 0, 'empty vision chat content');
  return model;
}

async function main() {
  console.log('Icarus T34 llm-vision');
  if (skipLive()) {
    console.log('  skip live (ICARUS_C0_SKIP_LIVE=1)');
    process.exit(0);
  }
  const ok = await runNamed('live: chat with image payload', live);
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
