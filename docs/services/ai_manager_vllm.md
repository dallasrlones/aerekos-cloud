# ai_manager — LLM (vLLM)

> **AI** · High-throughput local inference via vLLM (OpenAI-compatible API).

vLLM runs as a standalone service on the GPU host (`worker/docker-compose.vllm.yml`). ai_manager proxies `/v1/chat/completions` and normalizes responses to the Ollama `{ message: { role, content } }` shape so existing clients (icarus-assistant) stay compatible.

## Orin model mapping (Phase 0)

| Ollama | vLLM (HF) |
|--------|-----------|
| `qwen3.6:latest` (qwen35moe, 36B, Q4_K_M) | `cyankiwi/Qwen3.6-35B-A3B-AWQ-4bit` |

JetPack R36 on oculus; image: `ghcr.io/nvidia-ai-iot/vllm:latest-jetson-orin`.

Paged attention and continuous batching are enabled by default. Tune with `--max-num-seqs`, `--gpu-memory-utilization`, `--max-model-len` in compose.

## Endpoints

Same paths as Ollama LLM (`/api/v1/llm/*`). Routes that require Ollama model management return `409 not_supported_for_vllm`:

- `POST /llm/models/pull`
- `DELETE /llm/models/:name`

`GET /llm/models` and `GET /llm/models/:name` list/show whatever vLLM is currently serving. Console CRUD stores serving flags (`quantization`, `dtype`, `gpu_memory_utilization`, `max_model_len`, `max_num_seqs`, prefix cache, eager, reasoning parser) on the endpoint `options` JSON. Applying them requires restarting `aerekos-vllm` with matching compose flags — the console does not start or stop that process.

Benchmarks remain Ollama-only until a vLLM bench path exists.

## Configuration

| Variable | Description |
|----------|-------------|
| `VLLM_HOST` | vLLM server URL (e.g. `http://host.docker.internal:8000`) |
| `VLLM_DEFAULT_MODEL` | Served model id (HF path) |
| `VLLM_API_KEY` | Optional bearer for `/v1/*` |
| `LLM_BACKEND` | Default backend when no integration: `ollama` or `vllm` |

## Integration seed

`POST /api/v1/providers/seed-local` creates `orin-vllm` alongside `orin-ollama`. Default follows `LLM_BACKEND`.

## Deploy

```bash
# vLLM only
cd worker && docker compose -f docker-compose.vllm.yml up -d

# vLLM + ai_manager
bash scripts/deploy/deploy.sh ai-vllm
```

## Smoke

```bash
APP_TOKEN=... bash worker/ai_manager/scripts/smoke-vllm.sh
```

## Cutover / rollback

See [vllm_orin_cutover.md](../ops/vllm_orin_cutover.md).
