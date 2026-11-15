# AI Manager

Model endpoints, routing, inference proxy, memory, STT/TTS, agents/Icarus, and LoRA jobs for local or remote backends (Ollama / vLLM on the GPU worker).

Apps should call **aerekos-sdk** (`client.intelligence.chat` / `usage` / `submit`, `stt.transcribe`, `tts.synthesize`) — not raw `/api/services/ai_manager` fetch. Usage: `GET /api/v1/intelligence/usage?user_id=` (registered before `/:id`), 90-day retention. Attach a load balancer with `POST /intelligence/:id/attach-balancer`.

Do **not** start a second Whisper / Kokoro / Ollama / vLLM for a second app. Bind integrations; deploy sidecars only if they are down.

## Status

**Implemented (large surface) — needs-keys for live inference.** SQLite via `aerekos-record` for models/providers/intelligence/agents metadata. Live LLM/STT/TTS calls need reachable provider URLs (+ keys where required). No production `MOCK_*` inference flags — missing backends fail closed. Console: **`/icarus`** (legacy `/services/ai_manager` redirects). See [`plan.md`](./plan.md).

Live on oculus (`docker compose -p aerekos-ai -f worker/docker-compose.ai.yml`). Named volume `aerekos-ai_ai_manager-data` — do not delete it (LLM providers + memory sqlite). `MEMORY_DB_FALLBACK=1` is the homelab default.

`multer` is a required dependency so `api/routes/stt.js` mounts. If it is missing, logs say `[ai_manager] ./stt not mounted`.

**Do not rebuild sibling `auth_manager` from Mac** unless that tree still exposes `POST /api/v1/auth/token` (Icarus C0 mint).

## Quick start (local)

```bash
cd worker/ai_manager
cp .env_example .env
npm install
npm start
# curl http://localhost:3126/health
```

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

## Health / proxy

| Path | Behavior |
|------|----------|
| `GET /health`, `GET /ready` | SQLite liveness/readiness; conductor **exempts** these from `projectId` |
| Port | **3126** (`managerServicePorts.ai_manager`) |
| Proxy | `{VERB} {CONDUCTOR}/api/services/ai_manager{path}` |
| Product APIs | Require `project_id` (query, body, or `X-Project-Id`) via conductor proxy |

## HTTP (product)

Proxy base: `{CONDUCTOR}/api/services/ai_manager`.

| Area | Path prefix | Notes |
|------|-------------|--------|
| Health | `/health`, `/ready` | sqlite |
| Info | `/api/v1/info` | `status: active` |
| Models | `/api/v1/models` | Routing config CRUD (also used by click-ops) |
| LLM | `/api/v1/llm/chat` | Strip `project_id`/`resource` before Ollama |
| Embeddings | `/api/v1/embeddings` | |
| Memory | `/api/v1/memory/*` | setup must include `config.data_worker_id: 'local'` |
| Providers | `/api/v1/providers`, `POST .../seed-local` | `orin-ollama`, `orin-vllm`, embeddings, tts, stt |
| Intelligence | `/api/v1/intelligence` | Stable invoke ARN; bind LLM, attach RAG/memory |
| RAG | `/api/v1/rag` | Collections + document ingest/search |
| LoRA | `/api/v1/lora/train`, `/attach`, `GET /`, `GET /:id` | Queue on disk; GPU worker trains |
| Agents / Icarus | `/api/v1/agents`, `/api/v1/icarus` | Console `/icarus` |
| Engines | `/api/v1/engines` | Fleet placements |
| Connectors | `/api/v1/connectors` | |
| STT / TTS | `/api/v1/stt/*`, `/api/v1/tts/*` | needs multer for STT |
| Metrics | `/metrics` | Prometheus via shared helper |

**OpenAPI:** none checked in for this manager (surface is large). Catalog + this README are the honesty sources; regenerate site docs from `docs/catalog.js` carefully.

## Compose (GPU host)

Build context is the parent `worker/` directory:

```bash
cd worker
docker compose -p aerekos-ai -f docker-compose.ai.yml up -d --no-deps --build ai_manager
# LoRA sidecar (does not touch vLLM):
docker compose -p aerekos-ai -f docker-compose.ai.yml up -d --no-deps lora_trainer
```

Do **not** restart a healthy `aerekos-vllm` to ship ai_manager. Registration may log “Port 3126 in use, trying 3127” because `portDetection` runs **after** `listen(3126)` — host publish `3126:3126` still hits the process on 3126.

## SDK / CLI

Typed helpers: `client.intelligence.*`, `client.stt.*`, `client.tts.*`, `client.agents.*`, `client.connectors.*`. Catalog: `aerekos-sdk/managers.generated.js` → `ai_manager` (CRUD segment `intelligence`).

```js
await client.intelligence.create(PID, { name: 'demo' });
await client.intelligence.list(PID);
await client.intelligence.chat(PID, { messages: [{ role: 'user', content: 'hi' }] }); // needs LLM
```

```bash
# Dedicated verbs (job queue)
aerekos intelligence submit --project $PID --data '{"messages":[{"role":"user","content":"hi"}]}'
aerekos intelligence job <id> --project $PID

# Generic call for CRUD
aerekos call ai_manager POST "/api/v1/intelligence" --project $PID \
  --data '{"project_id":"'"$PID"'","name":"demo"}'
```

There is **no** `aerekos ai_manager intelligence create` verb — use SDK, `aerekos call`, or `aerekos intelligence …`.

## Tutorial / ServiceGuide

- **Guide:** [`docs/guides/icarus.md`](../../docs/guides/icarus.md) (catalog `docsGuide`)
- **Console:** `/icarus` + in-console guides (`conductor/app/screens/AIManager/guides.js`)
- **Standalone tutorial under `docs/tutorials`:** none

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit (scoped closeout) | `npm run test:unit` | localDefaults + port |
| Integration | `npm run test:integration` | health/ready/info + models CRUD |
| Full unit ocean | `npx jest tests/unit --no-coverage` | Icarus/agents/voice — not Wave 2 gate |
| E2E (live) | `tests/e2e/README.md` | conductor/proxy + keys |

## Related

- Conductor proxy auth / streaming: [`docs/runbooks/mixed-stack.md`](../../docs/runbooks/mixed-stack.md)
- STT: [`docs/services/ai_manager_stt.md`](../../docs/services/ai_manager_stt.md)
- LoRA: [`docs/services/ai_manager_lora.md`](../../docs/services/ai_manager_lora.md)
- vLLM cutover: [`docs/ops/vllm_orin_cutover.md`](../../docs/ops/vllm_orin_cutover.md)
- Docs: [`docs/services/ai_manager.md`](../../docs/services/ai_manager.md)
