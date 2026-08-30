# ai_manager — Speech-to-text

> **AI** · faster-whisper STT on the GPU worker.

Proxies to `stt-service` (default port **8001** on Orin). Uses the Icarus multipart contract.

**Dependency:** `multer` must be in `worker/ai_manager/package.json`. Routes are loaded in a try/catch in `api/routes/index.js`. Missing multer → log `[ai_manager] ./stt not mounted` and no `/stt` routes. Homelab image was rebuilt with `multer@1.4.5-lts.2` (STT mount confirmed). Prefer keeping this dep on every rebuild.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/stt/status` | Upstream health (model, device) |
| `POST` | `/api/v1/stt/transcribe` | Multipart `file` field |
| `POST` | `/api/v1/stt/transcribe/json` | `{ audio_base64, content_type?, language?, task? }` |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `STT_URL` | `http://host:8001` | faster-whisper service base URL |

## Example (JSON)

```bash
B64=$(base64 -w0 sample.wav)
curl -s -X POST "$CONDUCTOR/api/services/ai_manager/api/v1/stt/transcribe/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"audio_base64\":\"$B64\",\"content_type\":\"audio/wav\"}"
```
