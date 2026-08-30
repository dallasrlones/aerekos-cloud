# ai_manager — LLM (Ollama)

> **AI** · GPU-accelerated local inference via Ollama.

Ollama runs on the worker GPU host (native on Jetson Orin, or a supervised container sharing `OLLAMA_MODELS_DIR`). Models pulled via the API or CLI are visible to both native and container backends.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/llm/status` | Backend mode, reachability, version, model count |
| `GET` | `/api/v1/llm/models` | List installed models |
| `GET` | `/api/v1/llm/models/pulls` | Background pull progress |
| `POST` | `/api/v1/llm/models/pull` | Start pull `{ "model": "llama3.2:3b" }` |
| `POST` | `/api/v1/llm/chat` | Chat `{ model, messages[] }` |
| `POST` | `/api/v1/llm/generate` | Complete `{ model, prompt }` |

## Configuration

| Variable | Description |
|----------|-------------|
| `OLLAMA_HOST` | External daemon URL (e.g. `http://host.docker.internal:11434`) |
| `OLLAMA_MODELS_DIR` | Host path bind-mounted for shared models |
| `OLLAMA_MODE` | `external` (default on Orin) or `container` |

## Example

```bash
curl -s "$CONDUCTOR/api/services/ai_manager/api/v1/llm/status" \
  -H "Authorization: Bearer $TOKEN"
```
