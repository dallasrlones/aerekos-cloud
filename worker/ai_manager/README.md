# AI Manager

Model endpoints, routing, inference proxy, memory, STT/TTS, and LoRA jobs for local or remote backends (Ollama / vLLM on the GPU worker).

Apps should call **aerekos-sdk** (`client.intelligence.chat` / `usage`, `stt.transcribe`, `tts.synthesize`) — not `/api/services/ai_manager` fetch. Usage: `GET /api/v1/intelligence/usage?user_id=` (registered before `/:id`), 90-day retention. Attach a load balancer with `POST /intelligence/:id/attach-balancer`.

Do **not** start a second Whisper / Kokoro / Ollama / vLLM for a second app. Bind integrations; deploy sidecars only if they are down.

## Status

Live on oculus (`docker compose -p aerekos-ai -f worker/docker-compose.ai.yml`). Named volume `aerekos-ai_ai_manager-data` — do not delete it (LLM providers + memory sqlite). `MEMORY_DB_FALLBACK=1` is the homelab default.

`multer` is a required dependency so `api/routes/stt.js` mounts. If it is missing, logs say `[ai_manager] ./stt not mounted`.

**Do not rebuild sibling `auth_manager` from Mac** unless that tree still exposes `POST /api/v1/auth/token` (Icarus C0 mint).

## Compose (GPU host)

Build context is the parent `worker/` directory:

```bash
cd worker
docker compose -p aerekos-ai -f docker-compose.ai.yml up -d --no-deps --build ai_manager
# LoRA sidecar (does not touch vLLM):
docker compose -p aerekos-ai -f docker-compose.ai.yml up -d --no-deps lora_trainer
```

Do **not** restart a healthy `aerekos-vllm` to ship ai_manager. Registration may log “Port 3126 in use, trying 3127” because `portDetection` runs **after** `listen(3126)` — host publish `3126:3126` still hits the process on 3126.

## Environment

See [`.env_example`](./.env_example). Important live keys:

| Variable | Role |
|----------|------|
| `CONDUCTOR_URL` | Register with conductor |
| `OLLAMA_HOST` | Native GPU Ollama |
| `VLLM_HOST` / `LLM_BACKEND` | vLLM OpenAI server; default backend when no integration is selected |
| `AUTH_MANAGER_URL` | App JWT verify |
| `MEMORY_DB_FALLBACK` | sqlite memory if Lance hooks missing |
| `STT_URL` / `TTS_*` | Voice upstreams on the Orin host |
| `LORA_BASE_MODEL` / `LORA_MAX_STEPS` | Trainer sidecar (compose) |

## HTTP (product)

Proxy base: `{CONDUCTOR}/api/services/ai_manager`.

| Area | Path prefix | Notes |
|------|-------------|--------|
| Health | `/health`, `/ready` | sqlite |
| LLM | `/api/v1/llm/chat` | Strip `project_id`/`resource` before Ollama |
| Embeddings | `/api/v1/embeddings` | |
| Memory | `/api/v1/memory/*` | setup must include `config.data_worker_id: 'local'` |
| Providers | `/api/v1/providers`, `POST .../seed-local` | `orin-ollama`, `orin-vllm`, embeddings, tts, stt |
| Intelligence | `/api/v1/intelligence` | Stable invoke ARN; bind LLM, attach RAG/memory |
| RAG | `/api/v1/rag` | Collections + document ingest/search |
| LoRA | `/api/v1/lora/train`, `/attach`, `GET /`, `GET /:id` | Queue on disk; GPU worker trains |
| STT | `/api/v1/stt/*` | needs multer |
| TTS | `/api/v1/tts/*` | |

## Testing

| Layer | Command |
|-------|---------|
| Unit | `npm run test:unit` |
| Integration | `npm run test:integration` |
| Icarus live | `node e2e/icarus-c0-smoke.js` (repo root) + `e2e/lora-*.js` |

## Related

- Conductor proxy auth / streaming: [`docs/runbooks/mixed-stack.md`](../../docs/runbooks/mixed-stack.md)
- STT: [`docs/services/ai_manager_stt.md`](../../docs/services/ai_manager_stt.md)
- LoRA: [`docs/services/ai_manager_lora.md`](../../docs/services/ai_manager_lora.md)
- vLLM cutover: [`docs/ops/vllm_orin_cutover.md`](../../docs/ops/vllm_orin_cutover.md)
