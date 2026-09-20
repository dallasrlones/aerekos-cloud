# ai_manager — Text-to-speech

> **AI** · Configurable TTS with dictionary cache, Kokoro, or XTTS backends.

Follows the [icarus voice contract](https://github.com/aerekos/icarus): `POST /synthesize` returns `audio/wav`.

## Backends (`TTS_BACKEND`)

| Mode | Upstream | Use case |
|------|----------|----------|
| `cache` | tts-cache-api (:8015) | **Stored words** from SQLite dictionary (370k+ on Orin) + live synth for misses |
| `kokoro` | tts-kokoro (:8013) | GPU Kokoro-82M, preset voices |
| `xtts` | tts-service (:8002) | GPU XTTS-v2 multilingual |

The Orin dictionary generator (`aerekos-tts-cache-gen`) is **not modified** by ai_manager — it completed and is idle. ai_manager only reads the shared `words.db` via the cache API.

**Deployer:** aerekos-cloud AI Manager **Engines** tab (`POST /api/v1/engines`). Place Whisper / Kokoro / cache / vLLM / XTTS / Ollama on a GPU worker. Apps only consume integrations (`orin-stt`, …). A new device is `docker run` the worker — no host Ollama/tools install. vLLM, XTTS, and Ollama never auto-start. Tools compose and Container Hosting are not the product path for these engines.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/tts/status` | Active backend + upstream health |
| `GET` | `/api/v1/tts/cache/stats` | Dictionary coverage (cached vs total words) |
| `GET` | `/api/v1/tts/voices` | Voice catalog from upstream |
| `POST` | `/api/v1/tts/synthesize` | `{ text, voice?, language?, speed? }` → WAV |

## Example

```bash
curl -s -X POST "$CONDUCTOR/api/services/ai_manager/api/v1/tts/synthesize" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello from Aerekos"}' \
  --output speech.wav
```
