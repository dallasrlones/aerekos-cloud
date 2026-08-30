/** In-console documentation for local ai_manager. */

export const AI_GUIDES = {
  overview: {
    title: 'Getting started with AI Services',
    steps: [
      {
        title: 'Seed local endpoints',
        body: 'Endpoints tab → Setup local fleet. Creates orin-ollama, orin-vllm, orin-tts-cache, orin-stt, etc. from the GPU host env.',
      },
      {
        title: 'Confirm services are online',
        body: 'Overview shows LLM, TTS, STT, Embeddings health. All run on your Orin GPU host via ai_manager.',
      },
      {
        title: 'Pull an LLM model',
        body: 'LLM → pick the Ollama endpoint → Models → enter model name (e.g. llama3.2:3b) → Pull. vLLM does not pull; edit the endpoint Hugging Face id and restart the GPU container.',
      },
      {
        title: 'Pick an integration per capability',
        body: 'Each tab (LLM, TTS, STT, Embeddings) has an integration picker. Choose orin-ollama, orin-tts-cache, etc. or Host default.',
      },
      {
        title: 'Intelligence endpoints',
        body: 'Intelligence tab → Create intelligence. Bind an LLM, attach RAG collections and memory. Apps keep the same ARN when you swap the LLM.',
      },
      {
        title: 'App access',
        body: 'App access tab → create credential with endpoint ARNs + scopes → mint token → invoke with resource ARN.',
      },
    ],
  },
  endpoints: {
    title: 'AI endpoints',
    steps: [
      { title: 'Setup local fleet', body: 'POST /providers/seed-local — registers Ollama, vLLM, TTS backends, STT from ai_manager env.' },
      { title: 'List', body: 'GET /providers?project_id=… — each row includes arn (ai:llm:endpoint/name, etc.)' },
      { title: 'Create', body: 'POST /intelligence { name, llm_integration, rag[], memory[] } — stable ARN ai:intelligence:endpoint/name' },
      { title: 'Hot-swap LLM', body: 'PATCH /intelligence/:id { llm_integration } — ARN and app URLs do not change' },
      { title: 'Attach RAG', body: 'POST /intelligence/:id/attach { kind: "rag", target_name } — one RAG can attach to many intelligence endpoints' },
      { title: 'Test', body: 'POST /providers/:id/test — probes Ollama /api/tags or vLLM /health.' },
      { title: 'App invoke', body: 'App JWT + body.resource or X-Aerekos-Resource set to endpoint ARN on inference routes.' },
    ],
    config: [
      { key: 'orin-ollama', desc: 'LLM — Ollama on GPU host :11434' },
      { key: 'orin-vllm', desc: 'LLM — vLLM OpenAI-compatible server :8000 (quantization, dtype, gpu memory on options)' },
      { key: 'orin-tts-cache', desc: 'TTS — dictionary cache :8015' },
      { key: 'orin-tts-kokoro', desc: 'TTS — Kokoro :8013' },
      { key: 'orin-tts-xtts', desc: 'TTS — XTTS voice clone :8002' },
      { key: 'orin-stt', desc: 'STT — faster-whisper :8001' },
    ],
  },
  appaccess: {
    title: 'App credentials',
    steps: [
      { title: 'Create credential', body: 'POST /credentials { name, allowed_resources[], scopes[] } — secret returned once.' },
      { title: 'Mint token', body: 'POST /auth/token grant_type=client_credentials with client_id + client_secret.' },
      { title: 'Invoke', body: 'Bearer app token + resource ARN on /llm/chat, /embeddings, /tts/synthesize, /stt/transcribe.' },
      { title: 'Rotate', body: 'POST /credentials/:id/rotate — invalidates previous secret.' },
      { title: 'SDK', body: 'aerekos-sdk: auth.getAppToken() + invoke(client, { serviceName, path, resourceArn, body }).' },
      { title: 'Send-disabled', body: 'email/sms/slack/push queue only (outbound_disabled). Do not retry live send from this console.' },
    ],
  },
  /** @deprecated use endpoints */
  integrations: {
    title: 'AI endpoints',
    steps: [],
    config: [],
  },
  llm: {
    title: 'Large language models',
    steps: [
      { title: 'List models', body: 'GET /llm/models?integration=orin-ollama|orin-vllm&project_id=…' },
      { title: 'Pull (Ollama)', body: 'POST /llm/models/pull { model, integration, project_id } — 409 on vLLM' },
      { title: 'Chat', body: 'POST /llm/chat { model, messages[], integration, project_id }' },
      { title: 'Complete', body: 'POST /llm/generate { model, prompt, integration, project_id }' },
      { title: 'Delete (Ollama)', body: 'DELETE /llm/models/:name?integration=…&project_id=… — 409 on vLLM' },
    ],
    config: [
      { key: 'OLLAMA_HOST', desc: 'Host default — native GPU Ollama (:11434)' },
      { key: 'OLLAMA_MODELS_DIR', desc: 'Shared model volume (native + container)' },
      { key: 'VLLM_HOST', desc: 'vLLM OpenAI-compatible server (:8000)' },
      { key: 'VLLM_DEFAULT_MODEL', desc: 'Hugging Face id served by vLLM' },
      { key: 'LLM_BACKEND', desc: 'Default when no integration is selected: ollama or vllm' },
      { key: 'integration', desc: 'Per-request override — registered Ollama or vLLM endpoint' },
    ],
  },
  tts: {
    title: 'Text-to-speech',
    steps: [
      { title: 'Backends', body: 'cache = 370k dictionary; kokoro = lightweight; xtts = voice cloning.' },
      { title: 'Voices', body: 'GET /tts/voices?integration=orin-tts-cache&project_id=…' },
      { title: 'Synthesize', body: 'POST /tts/synthesize { text, voice?, integration, project_id } → WAV' },
      { title: 'Cache stats', body: 'GET /tts/cache/stats?integration=orin-tts-cache&project_id=…' },
    ],
    config: [
      { key: 'TTS_CACHE_URL', desc: 'Dictionary TTS :8015' },
      { key: 'TTS_KOKORO_URL', desc: 'Kokoro :8013' },
      { key: 'TTS_XTTS_URL', desc: 'XTTS :8002' },
      { key: 'integration', desc: 'Route to orin-tts-cache | kokoro | xtts' },
    ],
  },
  stt: {
    title: 'Speech-to-text',
    steps: [
      { title: 'Status', body: 'GET /stt/status?integration=orin-stt&project_id=…' },
      { title: 'Upload', body: 'POST /stt/transcribe — multipart file + project_id + integration fields' },
      { title: 'JSON', body: 'POST /stt/transcribe/json { audio_base64, integration, project_id }' },
    ],
    config: [
      { key: 'STT_URL', desc: 'faster-whisper on GPU host :8001' },
      { key: 'integration', desc: 'Route to orin-stt' },
    ],
  },
  benchmarks: {
    title: 'LLM model benchmarks',
    steps: [
      { title: 'Auto-run', body: 'ai_manager benches new models serially on startup, after pull, and every 15 min — one model at a time on GPU.' },
      { title: 'Suite', body: 'json-commands-v1: eat-cake prompt must return valid JSON with propose_create_task.' },
      { title: 'Results', body: 'GET /llm/benchmarks — pass/fail, wall_ms, reason per model. Skips already-benchmarked models.' },
      { title: 'Manual run', body: 'POST /llm/benchmarks/run — queue pending models. force=true re-benches all.' },
      { title: 'Models list', body: 'GET /llm/models?include_benchmarks=true attaches bench summary per model.' },
    ],
    config: [
      { key: 'LLM_BENCH_ENABLED', desc: 'Auto-benchmark (default true)' },
      { key: 'LLM_BENCH_KEEP_ALIVE', desc: '0 — unload model from VRAM between benches' },
      { key: 'LLM_BENCH_GAP_MS', desc: 'Pause between models (default 500ms)' },
      { key: 'BENCH_MAX_B', desc: 'Max parameter size to bench (default 12B)' },
    ],
  },
  embeddings: {
    title: 'Embeddings',
    steps: [
      { title: 'Status', body: 'GET /embeddings/status — default model from Ollama.' },
      { title: 'Embed', body: 'POST /embeddings { input, model?, integration, project_id }' },
      { title: 'RAG', body: 'Store vectors in db_manager; query with cosine similarity.' },
    ],
    config: [
      { key: 'EMBEDDING_MODEL', desc: 'Default: mxbai-embed-large via Ollama' },
      { key: 'integration', desc: 'Route to orin-embeddings / orin-ollama' },
    ],
  },
};

export const API_EXAMPLES = {
  seed_local: {
    method: 'POST',
    path: '/api/services/ai_manager/api/v1/providers/seed-local',
    desc: 'Register all local Orin endpoints for project',
    body: '{ "project_id": "d57d380d-acfe-49b0-b5a9-ba973892bc8b" }',
  },
  llm_status: {
    method: 'GET',
    path: '/api/services/ai_manager/api/v1/llm/status',
    desc: 'Host Ollama health',
  },
  llm_chat: {
    method: 'POST',
    path: '/api/services/ai_manager/api/v1/llm/chat',
    desc: 'Chat via registered Ollama (console / integration routing)',
    body: '{ "model": "llama3.2:3b", "integration": "orin-ollama", "project_id": "d57d380d-acfe-49b0-b5a9-ba973892bc8b", "messages": [{"role":"user","content":"Hello"}] }',
  },
  app_token: {
    method: 'POST',
    path: '/api/services/auth_manager/api/v1/auth/token',
    desc: 'Mint app JWT (client_credentials)',
    body: '{ "grant_type": "client_credentials", "client_id": "cred_…", "client_secret": "…" }',
  },
  llm_chat_arn: {
    method: 'POST',
    path: '/api/services/ai_manager/api/v1/llm/chat',
    desc: 'App credential invoke with resource ARN',
    body: '{ "resource": "arn:aerekos:d57d380d-acfe-49b0-b5a9-ba973892bc8b:ai:llm:endpoint/orin-ollama", "model": "llama3.2:3b", "messages": [{"role":"user","content":"Hello"}] }',
  },
  tts_synth: {
    method: 'POST',
    path: '/api/services/ai_manager/api/v1/tts/synthesize',
    desc: 'Synthesize via dictionary cache',
    body: '{ "text": "Hello from Orin", "integration": "orin-tts-cache", "project_id": "d57d380d-acfe-49b0-b5a9-ba973892bc8b", "voice": "af_heart" }',
  },
  stt_upload: {
    method: 'POST',
    path: '/api/services/ai_manager/api/v1/stt/transcribe',
    desc: 'Multipart file + integration + project_id form fields',
  },
  llm_benchmarks: {
    method: 'GET',
    path: '/api/services/ai_manager/api/v1/llm/benchmarks',
    desc: 'Benchmark results + pending + recommended fastest pass',
  },
  llm_benchmark_run: {
    method: 'POST',
    path: '/api/services/ai_manager/api/v1/llm/benchmarks/run',
    desc: 'Queue serial benchmark for unbenched models',
    body: '{ "integration": "orin-ollama", "project_id": "d57d380d-acfe-49b0-b5a9-ba973892bc8b" }',
  },
  embed: {
    method: 'POST',
    path: '/api/services/ai_manager/api/v1/embeddings',
    desc: 'Embed via local Ollama',
    body: '{ "input": "search query", "model": "mxbai-embed-large", "integration": "orin-embeddings", "project_id": "d57d380d-acfe-49b0-b5a9-ba973892bc8b" }',
  },
};
